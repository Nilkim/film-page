// 게시글 수정/삭제 Server Actions.
//
// 보안: 모든 액션은 (1) 인증 사용자 확인 (2) post.user_id == user.id 검증
// (3) Supabase RLS의 *_own 정책. 3중 방어로 권한 우회 차단.
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { TABLE, STORAGE } from '@/lib/db';
import { detectPlatform } from '@/lib/embed';

function s(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

// 게시글 삭제. RLS가 본인 글만 허용하지만 명시적으로 user_id 매치도 검증.
export async function deletePost(postId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다.');

  // 소유자 확인 (방어적 — RLS가 이미 막지만 명확한 에러 메시지 위해).
  const { data: post } = await supabase
    .from(TABLE.POSTS)
    .select('user_id, cover_image')
    .eq('id', postId)
    .maybeSingle();
  if (!post) throw new Error('게시글을 찾을 수 없습니다.');
  if (post.user_id !== user.id) throw new Error('본인 글만 삭제할 수 있어요.');

  // 1) Storage의 cover_image 파일 best-effort 정리. 실패해도 게시글 삭제는 진행.
  if (post.cover_image) {
    const path = extractStoragePath(post.cover_image);
    if (path) {
      await supabase.storage.from(STORAGE.COVERS_BUCKET).remove([path]).catch(() => {});
    }
  }

  // 2) 게시글 삭제.
  const { error } = await supabase.from(TABLE.POSTS).delete().eq('id', postId);
  if (error) throw new Error(`삭제 실패: ${error.message}`);

  revalidatePath('/');
  revalidatePath(`/posts/${postId}`); // 삭제된 글의 ISR 캐시도 무효화
}

// 게시글 수정. 제목/URL/대표이미지만 수정 가능. 패키지/주문번호는 불변.
export async function updatePost(postId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 소유자 확인.
  const { data: existing } = await supabase
    .from(TABLE.POSTS)
    .select('user_id, cover_image, external_url')
    .eq('id', postId)
    .maybeSingle();
  if (!existing) throw new Error('게시글을 찾을 수 없습니다.');
  if (existing.user_id !== user.id) throw new Error('본인 글만 수정할 수 있어요.');

  // 폼 데이터. og_*(외부 글 메타)는 저작권 의도로 수집하지 않음 — 폼이 보내도 무시.
  const title = s(formData.get('title'));
  const externalUrl = s(formData.get('external_url'));
  const coverFile = formData.get('cover_image');
  const removeCover = formData.get('remove_cover') === '1';

  if (!externalUrl) throw new Error('외부 링크 URL을 입력해 주세요.');
  if (!title) throw new Error('제목이 필요합니다.');

  // 대표 이미지 처리.
  // - 새 파일 업로드 → 새 path 저장, 이전 파일은 best-effort 정리
  // - "이미지 제거" 체크 → cover_image를 null, 이전 파일 정리
  // - 둘 다 안 함 → cover_image 그대로 유지
  let newCoverUrl: string | null | undefined = undefined; // undefined = 변경 없음
  let prevPathToDelete: string | null = null;

  if (coverFile && coverFile instanceof File && coverFile.size > 0) {
    if (coverFile.size > 5 * 1024 * 1024) throw new Error('대표 이미지는 5MB 이하만 가능해요.');
    if (!coverFile.type.startsWith('image/')) throw new Error('이미지 파일만 업로드 가능해요.');
    const ext = (coverFile.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase
      .storage
      .from(STORAGE.COVERS_BUCKET)
      .upload(path, coverFile, { contentType: coverFile.type, upsert: false });
    if (upErr) throw new Error(`이미지 업로드 실패: ${upErr.message}`);
    const { data: pub } = supabase.storage.from(STORAGE.COVERS_BUCKET).getPublicUrl(path);
    newCoverUrl = pub.publicUrl;
    if (existing.cover_image) prevPathToDelete = extractStoragePath(existing.cover_image);
  } else if (removeCover) {
    newCoverUrl = null;
    if (existing.cover_image) prevPathToDelete = extractStoragePath(existing.cover_image);
  }

  // 제목은 char_length 1~200 제약 — 코드포인트 단위 200자 클램프.
  const finalTitle =
    [...title].slice(0, 200).join('').trim() || '(제목 없음)';

  // DB 업데이트. og_* 컬럼은 건드리지 않음 — 기존 값은 그대로 두고, 신규 입력도 안 받음.
  // (코드가 og_* 를 읽지 않으므로 잔존 값이 있어도 무영향)
  const updates: Record<string, unknown> = {
    title: finalTitle,
    external_url: externalUrl,
    source_platform: detectPlatform(externalUrl),
  };
  if (newCoverUrl !== undefined) updates.cover_image = newCoverUrl;

  const { error } = await supabase.from(TABLE.POSTS).update(updates).eq('id', postId);
  if (error) throw new Error(`수정 실패: ${error.message}`);

  // 이전 cover 파일 best-effort 정리.
  if (prevPathToDelete) {
    await supabase.storage.from(STORAGE.COVERS_BUCKET).remove([prevPathToDelete]).catch(() => {});
  }

  revalidatePath('/');
  revalidatePath(`/posts/${postId}`);
  redirect(`/posts/${postId}`);
}

// Storage public URL에서 bucket 내 path 추출.
// 예: https://xxx.supabase.co/storage/v1/object/public/film-page-covers/{uid}/123.jpg
//   → '{uid}/123.jpg'
function extractStoragePath(publicUrl: string): string | null {
  const marker = `/object/public/${STORAGE.COVERS_BUCKET}/`;
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;
  return publicUrl.slice(i + marker.length);
}
