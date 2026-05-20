-- FilmPage 잔여 데이터 정리 스크립트.
--
-- 사용법: Supabase 대시보드 → SQL Editor에서 실행 (service_role로 동작 → RLS 우회).
-- 각 섹션은 ① 먼저 SELECT로 "지워질 행"을 확인하고, ② 결과가 맞으면 그 아래
-- DELETE를 실행하는 순서. 항상 ①로 확인 후 ②를 돌릴 것. DELETE는 되돌릴 수 없음.
--
-- 잔여물이 생기는 원인: 글쓰기 흐름이 "커버 업로드 → 패키지 insert → 게시글 insert"
-- 순서라, 중간에 실패하면 패키지/커버만 남고 게시글이 없는 고아 행이 생긴다.

-- =====================================================================
-- 1. 고아 패키지 — 게시글이 참조하지 않는 film_page_order_packages 행
-- =====================================================================

-- ① 확인 (지워질 행)
select p.package_code, p.user_seq, p.phone, p.order_codes, p.created_at
from public.film_page_order_packages p
where not exists (
    select 1 from public.film_page_posts po
    where po.package_code = p.package_code
)
order by p.created_at;

-- ② 삭제
delete from public.film_page_order_packages p
where not exists (
    select 1 from public.film_page_posts po
    where po.package_code = p.package_code
);

-- =====================================================================
-- 2. 고아 커버 이미지 — film-page-covers 버킷에 있으나 어떤 게시글도
--    cover_image로 참조하지 않는 Storage 파일
--    (cover_image는 .../film-page-covers/<object-name> 형태의 public URL)
-- =====================================================================

-- ① 확인 (지워질 파일)
select o.name, o.created_at, (o.metadata->>'size')::bigint as size_bytes
from storage.objects o
where o.bucket_id = 'film-page-covers'
  and not exists (
      select 1 from public.film_page_posts p
      where p.cover_image like '%/film-page-covers/' || o.name
  )
order by o.created_at;

-- ② 삭제 (DB 레코드 제거 → 대시보드 Storage UI에서도 사라짐)
delete from storage.objects o
where o.bucket_id = 'film-page-covers'
  and not exists (
      select 1 from public.film_page_posts p
      where p.cover_image like '%/film-page-covers/' || o.name
  );

-- =====================================================================
-- 3. 깨진 커버 참조 — 게시글의 cover_image가 가리키는 파일이 Storage에
--    없는 경우 (썸네일 깨짐). 보통은 cover_image를 null로 고치는 게 맞고,
--    게시글 자체를 지우진 않는다.
-- =====================================================================

-- ① 확인
select p.package_code, p.title, p.cover_image
from public.film_page_posts p
where p.cover_image is not null
  and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'film-page-covers'
        and p.cover_image like '%/film-page-covers/' || o.name
  );

-- ② 수정 (파일이 없는 cover_image를 null로 — 카드가 og_image/기본 썸네일로 폴백)
-- update public.film_page_posts p
-- set cover_image = null
-- where p.cover_image is not null
--   and not exists (
--       select 1 from storage.objects o
--       where o.bucket_id = 'film-page-covers'
--         and p.cover_image like '%/film-page-covers/' || o.name
--   );

-- =====================================================================
-- 4. 전체 현황 한눈에 보기 (참고용 — 삭제 아님)
-- =====================================================================
select
    (select count(*) from public.film_page_posts) as posts,
    (select count(*) from public.film_page_order_packages) as packages,
    (select count(*) from public.film_page_order_packages p
       where not exists (select 1 from public.film_page_posts po
                         where po.package_code = p.package_code)) as orphan_packages,
    (select count(*) from public.film_page_comments) as comments,
    (select count(*) from public.film_page_likes) as likes,
    (select count(*) from storage.objects where bucket_id = 'film-page-covers') as cover_files;
