// 댓글 + 좋아요 Server Actions.
//
// 모든 액션은 인증 사용자만. user_id는 본인 것만 허용(RLS와 앱 두 곳에서 검증).
// 변경 후 revalidatePath로 상세 페이지 + 메인 피드 갱신.
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { TABLE } from '@/lib/db';

function s(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

// 댓글 작성. RLS의 insert_own 정책 + 명시 user_id 매핑.
export async function addComment(postId: string, formData: FormData) {
  const body = s(formData.get('body'));
  if (!body) throw new Error('댓글 내용을 입력해 주세요.');
  if (body.length > 2000) throw new Error('댓글은 2000자 이하만 가능해요.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요.');

  const { error } = await supabase
    .from(TABLE.COMMENTS)
    .insert({ post_id: postId, user_id: user.id, body });
  if (error) throw new Error(`댓글 작성 실패: ${error.message}`);

  revalidatePath(`/posts/${postId}`);
}

// 댓글 삭제. RLS가 본인 글만 허용하지만 명시적으로 user_id 매치도 확인.
export async function deleteComment(commentId: string, postId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요.');

  const { data: existing } = await supabase
    .from(TABLE.COMMENTS)
    .select('user_id')
    .eq('id', commentId)
    .maybeSingle();
  if (!existing) throw new Error('댓글을 찾을 수 없어요.');
  if (existing.user_id !== user.id) throw new Error('본인 댓글만 삭제할 수 있어요.');

  const { error } = await supabase.from(TABLE.COMMENTS).delete().eq('id', commentId);
  if (error) throw new Error(`삭제 실패: ${error.message}`);

  revalidatePath(`/posts/${postId}`);
}

// 좋아요 토글 — 이미 누른 상태면 취소, 아니면 추가.
// 반환: { liked: 현재 상태, count: 최신 카운트 }
export async function toggleLike(postId: string): Promise<{ liked: boolean; count: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요.');

  // 현재 본인 좋아요 여부 확인.
  const { data: existing } = await supabase
    .from(TABLE.LIKES)
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    // 취소
    const { error } = await supabase
      .from(TABLE.LIKES)
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id);
    if (error) throw new Error(`좋아요 취소 실패: ${error.message}`);
  } else {
    // 추가
    const { error } = await supabase
      .from(TABLE.LIKES)
      .insert({ post_id: postId, user_id: user.id });
    if (error) throw new Error(`좋아요 실패: ${error.message}`);
  }

  // 최신 카운트.
  const { count } = await supabase
    .from(TABLE.LIKES)
    .select('post_id', { count: 'exact', head: true })
    .eq('post_id', postId);

  revalidatePath(`/posts/${postId}`);
  return { liked: !existing, count: count ?? 0 };
}
