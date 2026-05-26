// 게시글 생성 Server Action.
//
// 흐름:
//   1. 인증 검증
//   2. 주문번호 1개 이상 + 전화번호 확인
//   3. 대표 이미지가 있으면 Supabase Storage에 업로드 → public URL
//   4. 패키지 생성 (PKG-XXXXXXXX) → film_page_order_packages
//   5. post_type 결정 (URL 유무) + source_platform 감지
//   6. film_page_posts INSERT (package_code, cover_image, ...)
//   7. revalidate + redirect /posts/[id]
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { TABLE, POST_TYPE, STORAGE } from '@/lib/db';
import { detectPlatform } from '@/lib/embed';
import { createPackage } from '@/lib/orders';

function s(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ===== 폼 데이터 =====
  const title = s(formData.get('title'));
  const body = s(formData.get('body'));
  const externalUrl = s(formData.get('external_url'));
  const phone = s(formData.get('phone'));
  const orderCodes = formData
    .getAll('order_codes')
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  // og_title/og_description 은 저장하지 않음(저작권 의도). og_image 만 저장 —
  // 사용자가 폼에서 OG 미리보기로 본 썸네일이 자기 작품의 시각적 식별자가 되며,
  // cover_image 직접 업로드 안 한 경우 카드 썸네일로 사용된다(사용자 결정).
  const ogImage = s(formData.get('og_image')) || null;
  const coverFile = formData.get('cover_image');
  const packageName = s(formData.get('package_name'));

  // ===== 검증 =====
  // 모든 게시글은 외부 링크 기반 (내부 본문 작성 기능 제거됨).
  if (orderCodes.length === 0) {
    throw new Error('주문 번호를 1개 이상 선택해 주세요.');
  }
  if (!packageName) {
    throw new Error('패키지 이름을 입력해 주세요.');
  }
  if (!externalUrl) {
    throw new Error('외부 링크 URL을 입력해 주세요.');
  }
  if (!title) {
    throw new Error('제목을 입력해 주세요.');
  }

  // ===== 대표 이미지 업로드 =====
  let coverUrl: string | null = null;
  if (coverFile && coverFile instanceof File && coverFile.size > 0) {
    if (coverFile.size > 5 * 1024 * 1024) {
      throw new Error('대표 이미지는 5MB 이하만 가능해요.');
    }
    if (!coverFile.type.startsWith('image/')) {
      throw new Error('이미지 파일만 업로드 가능해요.');
    }
    const ext = (coverFile.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase
      .storage
      .from(STORAGE.COVERS_BUCKET)
      .upload(path, coverFile, {
        contentType: coverFile.type,
        upsert: false,
      });
    if (upErr) {
      throw new Error(`이미지 업로드 실패: ${upErr.message}`);
    }
    const { data: pub } = supabase
      .storage
      .from(STORAGE.COVERS_BUCKET)
      .getPublicUrl(path);
    coverUrl = pub.publicUrl;
  }

  // ===== 패키지 생성 =====
  // 패키지 이름(package_code)은 작성자 입력값. 중복/형식 검증은 createPackage 내부에서.
  const pkg = await createPackage(supabase, user, phone || null, orderCodes, packageName);

  // ===== 게시글 분류 =====
  // 항상 LINK 타입 — 내부 본문 작성 기능 제거됨. body는 빈 문자열로 저장.
  const sourcePlatform = detectPlatform(externalUrl);

  // 제목은 DB 제약 char_length(title) between 1 and 200. 코드포인트 200자로 클램프.
  // (Array.from = 코드포인트 단위 → Postgres char_length와 일치, 서로게이트 쌍 안전)
  const finalTitle =
    [...title].slice(0, 200).join('').trim() || '(제목 없음)';

  // 저작권 의도: og_title/og_description 은 row 에 포함하지 않아 DB NULL 로 저장.
  // og_image 만 저장(카드 썸네일용). 상세 페이지의 title/description 은 매 요청
  // fetchOgMeta 로 fresh fetch.
  const row = {
    user_id: user.id,
    title: finalTitle,
    body, // 빈 문자열 — DB의 char_length(body) <= 10000 제약 통과
    image_urls: [],
    cover_image: coverUrl,
    order_code: orderCodes[0], // legacy 호환 — 첫 주문번호
    package_code: pkg.package_code,
    post_type: POST_TYPE.LINK,
    external_url: externalUrl,
    source_platform: sourcePlatform,
    og_image: ogImage,
  };

  const { data, error } = await supabase
    .from(TABLE.POSTS)
    .insert(row)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '게시글 생성 실패');
  }

  revalidatePath('/');
  redirect(`/posts/${data.id}`);
}
