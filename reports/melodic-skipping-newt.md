# 외부 이미지 URL 일괄 image-proxy 경유 처리

## Context

네이버 블로그 이미지가 일부 위치에서 `ERR_BLOCKED_BY_ORB`로 차단되고 있다.
사용자가 단서를 정확히 짚어줬다:

- 직접 `https://blogthumb.pstatic.net/...`로 가져오면 차단
- 우리 `/api/image-proxy?url=...`를 거치면 정상

본문 추출(`ExtractedBody`)은 [extract.ts](../src/lib/extract.ts)의 `postProcessImages`가
이미 호스트 화이트리스트를 보고 src를 proxy URL로 rewrite한다. **그러나 OG 단일
이미지(`og_image`)와 클라이언트 OG fetch 결과(`og.image`)는 변환 없이 그대로
`<img src>`에 박혀서 ORB가 발동된다.** 이 변환을 단일 헬퍼로 추출하고 모든
외부 이미지 표시점에 적용한다.

## 결정 사항

- **변환 시점**: 표시 시점에 변환. DB에는 원본 OG URL 그대로 저장 (정책 변경 시
  재마이그레이션 없음).
- **헬퍼 위치**: `src/lib/imageProxy.ts` **신규 모듈**. `shouldProxy`/`toProxyUrl`/
  `proxyIfNeeded` 3개 함수만 노출. extract.ts의 중복 로직 제거 + 새 모듈 import.
- **DRY**: 호스트 화이트리스트 상수(`PROXY_HOST_SUFFIXES`)도 이 모듈로 옮겨,
  [src/app/api/image-proxy/route.ts](../src/app/api/image-proxy/route.ts)의 `ALLOWED_HOST_SUFFIXES`와
  의미적으로 짝지어 둔다(코드 직접 공유는 안 함 — server-only route와 client-safe
  lib는 별도 그래프).

## 파일별 변경

### 1. [src/lib/imageProxy.ts](../src/lib/imageProxy.ts) — **신규**

```ts
const PROXY_HOST_SUFFIXES = [
  'pstatic.net',     // 네이버 (blogfiles, postfiles, mblogthumb-phinf, blogthumb 등 모든 서브도메인)
  'naver.com',
  'daumcdn.net',     // 티스토리/카카오
  'kakaocdn.net',
];

export function shouldProxy(rawUrl: string): boolean { /* URL 파싱 → 호스트 suffix 매치 */ }
export function toProxyUrl(rawUrl: string): string { /* `/api/image-proxy?url=${encoded}` */ }

// null-safe 편의 함수 — 우리 도메인이거나 빈 값이면 그대로, hotlink 위험 호스트면 proxy로.
export function proxyIfNeeded(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  return shouldProxy(rawUrl) ? toProxyUrl(rawUrl) : rawUrl;
}
```

### 2. [src/lib/extract.ts](../src/lib/extract.ts) — 중복 로직 제거

- 기존 `PROXY_HOST_SUFFIXES`, `shouldProxy`, `toProxyUrl` 함수 본문 제거
- `import { shouldProxy, toProxyUrl } from './imageProxy';`로 교체
- `postProcessImages` 내부 호출은 그대로 (동일 시그니처)

### 3. [src/components/PostCard.tsx](../src/components/PostCard.tsx) — 카드 썸네일

```tsx
import { proxyIfNeeded } from '@/lib/imageProxy';
// ...
const thumb = post.cover_image ?? proxyIfNeeded(post.og_image) ?? proxyIfNeeded(post.image_urls?.[0]) ?? null;
```

- `cover_image`는 Supabase Storage URL이라 자연스럽게 화이트리스트 미매치 → 변환 안 됨
- `og_image`/`image_urls`만 외부 호스트면 proxy 경유

### 4. [src/app/posts/[id]/page.tsx](../src/app/posts/%5Bid%5D/page.tsx) — 두 군데

```tsx
import { proxyIfNeeded } from '@/lib/imageProxy';

// 라인 ~166: image_urls 배열 렌더
{post.image_urls.map((src) => (
  <img key={src} src={proxyIfNeeded(src) ?? ''} ... />
))}

// 라인 ~239: OG 카드 폴백 이미지
{post.og_image && (
  <img src={proxyIfNeeded(post.og_image) ?? ''} ... />
)}
```

`cover_image`는 그대로 (Storage URL).

### 5. [src/app/posts/new/NewPostForm.tsx](../src/app/posts/new/NewPostForm.tsx) — OG 미리보기

```tsx
import { proxyIfNeeded } from '@/lib/imageProxy';
// ...
{og.image && (
  <img src={proxyIfNeeded(og.image) ?? ''} ... />
)}
```

hidden input의 `og_image` 값은 **원본 URL 그대로 전송** (DB에 원본 저장). 변환은 표시에만.

### 6. [src/app/posts/[id]/edit/EditPostForm.tsx](../src/app/posts/%5Bid%5D/edit/EditPostForm.tsx) — OG 미리보기

```tsx
import { proxyIfNeeded } from '@/lib/imageProxy';
// ...
{og.image && (
  <img src={proxyIfNeeded(og.image) ?? ''} ... />
)}
```

`currentCover`(coverPreview > post.cover_image)는 그대로. coverPreview는 data URL,
post.cover_image는 Supabase Storage URL — 둘 다 변환 불필요.

## 재사용할 기존 자산

| 위치 | 용도 |
|------|------|
| [src/app/api/image-proxy/route.ts](../src/app/api/image-proxy/route.ts) | 서버 측 proxy 핸들러. referer 위장 + 호스트 검증 + nosniff. **변경 없음** |
| extract.ts의 `postProcessImages` | 본문 img rewrite. 새 모듈을 import만 추가 |

## 검증

1. **타입체크 + 빌드**
   ```
   npx tsc --noEmit
   npx next build
   ```
   둘 다 통과해야 함.

2. **브라우저 확인** (agent-browser 또는 수동)
   - `/posts/<네이버블로그글 id>` 진입 → 콘솔에 `ERR_BLOCKED_BY_ORB` 메시지 0건
   - DevTools Elements → 카드 썸네일 `<img>` src가 `/api/image-proxy?url=...` 형태
   - DevTools Network → `pstatic.net` 직접 요청 없음. 모두 `/api/image-proxy` 경유
   - 시각적으로 이미지가 떠야 함

3. **회귀 확인**
   - 본문 추출(ExtractedBody)은 기존처럼 정상 (extract.ts의 import 경로만 바뀌었으니 동작 동일)
   - cover_image(직접 업로드한 대표 이미지)는 그대로 직접 표시 (proxy 안 거침 — Storage URL이라 화이트리스트 미매치)

## 영향 범위 짚기

- DB 변경 없음
- 새 의존성 없음
- 빌드 영향 없음 (lib 모듈 1개 추가)
- 서버 부담 증가 가능성: og_image까지 image-proxy를 거치면서 트래픽이 우리 서버를
  더 통과함. 1일 캐시 헤더(`Cache-Control: public, max-age=86400`)가 이미 적용되어
  있어 같은 이미지 반복 요청은 브라우저/엣지가 처리 — 부담 작음.
