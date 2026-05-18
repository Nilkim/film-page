// 테이블 명 한 곳에서 관리.
//
// 같은 Supabase 프로젝트에 향후 다른 커뮤니티 인스턴스(예: wood_page,
// fabric_page 등)가 추가될 가능성을 대비해 모든 테이블에 사이트별 prefix
// 를 붙인다. 인스턴스마다 코드에서 이 상수만 바꾸면 깔끔하게 분리됨.
// (단일 테이블 + site_slug 컬럼 방식은 매 쿼리 WHERE 부담이 있고, custom
// PostgreSQL schema는 RLS/대시보드 사용성에 약간 부담이라 prefix 선택.)
export const TABLE = {
  POSTS: 'film_page_posts',
  COMMENTS: 'film_page_comments',
  LIKES: 'film_page_likes',
} as const;

// 게시글 종류 — DB의 post_type check 제약과 동일.
export const POST_TYPE = {
  TEXT: 'text',   // 사이트 내부에 직접 작성한 글
  LINK: 'link',   // 외부 URL 공유 (블로그/유튜브/인스타)
} as const;
export type PostType = (typeof POST_TYPE)[keyof typeof POST_TYPE];

// 외부 링크 플랫폼 — 임베드 가능 여부 분기에 사용.
export const SOURCE_PLATFORM = {
  YOUTUBE: 'youtube',
  INSTAGRAM: 'instagram',
  BLOG: 'blog',
} as const;
export type SourcePlatform = (typeof SOURCE_PLATFORM)[keyof typeof SOURCE_PLATFORM];

// film_page_posts 행 타입 (SELECT 결과).
export type Post = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  image_urls: string[];
  cover_image: string | null;
  order_code: string | null;
  package_code: string;
  post_type: PostType;
  external_url: string | null;
  source_platform: SourcePlatform | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  created_at: string;
  updated_at: string;
};

// film_page_order_packages 행 타입.
export type OrderPackage = {
  id: string;
  package_code: string;
  user_id: string;
  phone: string | null;
  order_codes: string[];
  created_at: string;
};

// FilmCutting orders 연동.
//
// orders 테이블은 RLS가 anon SELECT를 막아둠 — 직접 쿼리 불가.
// 대신 FilmCutting이 제공하는 `list_orders_by_phone(p_phone text)` RPC 함수를
// 호출. 이 함수는 security definer로 RLS 우회 + phone 정규화 후 비교.
// (FilmCutting 앱의 "주문조회" 버튼과 동일한 엔트리포인트)
export const ORDERS_RPC = 'list_orders_by_phone';

// Storage 버킷 — 게시글 대표 이미지.
export const STORAGE = {
  COVERS_BUCKET: 'film-page-covers',
} as const;

// 패키지 테이블.
export const PACKAGES_TABLE = 'film_page_order_packages';
