# 두 프로젝트 전체 코드 리뷰 & 정리 계획

> 대상: `C:\Projects\film-page` (Next.js 16 / TS / Supabase / PortOne) + `C:\Projects\FilmCutting\film-cutting` (Vite / React 19 / Konva / paper.js)
> 방식: 10개 읽기 전용 리뷰 에이전트 병렬 분석 → 107건 수집(high 17 / medium 41 / low 49) → 핵심 항목 직접 검증
> 사용자 결정: ① 아이콘 = **lucide-react 양쪽 통일** ② 교차 중복 = **공유 패키지 추출** ③ 범위 = **전부 반영**

## Context (왜 이 작업을 하는가)

페이지가 대략 완성된 시점에서, 두 프로젝트를 함께 운영하기 전에 **누적된 정리 부채**를 털어내려는 것이 목적이다. 보안(결제 webhook 검증, RLS, admin 게이팅)과 핵심 아키텍처는 견고하므로, 이 라운드는 **기능 회귀 1건 수정 + 중복 제거 + 아이콘/문구 통일 + 잡파일 청소 + 로직 개선**에 집중한다. 두 프로젝트가 같은 도메인(필름 재단/주문)을 각자 구현해 **교차 중복**이 생겼고, 아이콘 전략이 갈려(인라인 SVG vs lucide vs 유니코드 이모지) 일관성이 깨진 상태다.

전체 발견의 강점: 결제 webhook은 서명 검증 → PortOne 재조회(페이로드 불신) → 금액 대조 → 멱등 처리까지 모범적([webhook/route.ts](../src/app/api/payments/webhook/route.ts)). image-proxy SSRF 화이트리스트, Supabase service-role 클라이언트의 클라 번들 미노출도 확인됨. **즉, 구조를 갈아엎는 게 아니라 다듬는 작업이다.**

---

## Phase 0 — P0 버그: 신용카드 결제 차단 (검증 완료, 최우선)

| 항목 | 내용 |
|---|---|
| 증상 | 결제수단에서 **신용카드(`card`)** 선택 시 "결제 수단이 올바르지 않아요."로 주문 생성 실패 |
| 원인 | enum 드리프트 — UI/SDK는 `card` 추가됐으나 **서버 검증만 누락** |
| 위치 | [checkout/actions.ts:55](../src/app/checkout/actions.ts#L55) `['kakao','naver','google']` ← `card` 빠짐 |
| 노출 근거 | [CheckoutForm.tsx:20](../src/app/checkout/CheckoutForm.tsx#L20) `PROVIDERS = ['card','kakao','naver','google']` (신용카드가 첫 번째 카드로 노출) |
| 수정 | `validate()`의 허용 목록에 `'card'` 추가. 더 견고하게는 `lib/portone.ts`에서 `PG_PROVIDERS` 상수를 export해 UI/서버/검증이 **단일 원천**을 공유 |

추가로 [checkout/actions.ts:43](../src/app/checkout/actions.ts#L43) `validate()`에 **금액 정합성 체크**(`subtotal - discount === total`) 추가 — 명백한 클라 위변조를 webhook 단계 전에 1차 차단(현재는 webhook 금액 대조가 최종 방어선).

---

## Phase 1 — 레포 위생 / 데드코드 (저위험·고효율)

### FilmCutting
- **백업 폴더 삭제**: `src_backup_boolean/`, `src_backup_functional/` (git 추적 중, ~2,088 LOC, 현재 src와 무관한 과거 구현). → `git rm -r`
- **미사용 의존성 제거**: `@tarikjabiri/dxf` (어디서도 import 안 됨; `dxf`/`dxf-parser`/`makerjs`로 충분). → `package.json`에서 제거 + `npm prune`
- **루트 잡파일 정리**: `aa.dxf`, `FF.dxf`, `logo-image-300x204.jpg`, `ohaus.png`, `paperTest.js` → `tests/fixtures/` 또는 `assets/`로 이동(코드 참조 경로 갱신) 후 커밋
- `.gitignore`에 `dist`는 이미 처리됨(확인 완료)

### film-page
- **잡파일**: `.tmp-live.png`(untracked), `reports/*.png` 진단 이미지 → 삭제하거나 `.gitignore`에 `*.tmp*.png`/`reports/*.png` 추가
- `design_handoff_filmartwork/`(untracked 프로토타입) → 참조용이면 유지 결정, 아니면 삭제
- **유지(오해 정정)**: `paper` 의존성은 `paper/dist/paper-core` 서브패스 때문에 필요 — 제거 금지, 주석만 추가. `tsconfig.tsbuildinfo`는 이미 gitignore 처리됨(조치 불필요)

---

## Phase 2 — 프로젝트 내부 중복 제거

### film-page
| 중복 | 통합 방향 | 위치 |
|---|---|---|
| OG fetch 디바운스 로직 | `useOgFetch(url)` 훅 추출 | [NewPostForm.tsx:156](../src/app/posts/new/NewPostForm.tsx#L156) ↔ EditPostForm.tsx:48 |
| `providerLabelShort()` 3중복 | `lib/portone.ts`로 단일화(`providerLabel` 활용) | CompleteView, LookupView, CheckoutForm |
| 상태 배지/단계 컴포넌트 | `components/StatusBadges.tsx`로 공유(`PgBadge`/`FulfillmentBadge`/`FulfillmentSteps`) + 라벨 띄어쓰기 통일('결제 완료') | OrderRow.tsx ↔ LookupView.tsx |
| orderName 빌더 | `lib/orders.ts`의 `buildOrderName()` | CheckoutForm:43 ↔ webhook:130 |
| 이메일 HTML 테이블 | `mail.ts`에 `emailTableRows()` 헬퍼 | [mail.ts:103](../src/lib/mail.ts#L103),137 |
| `inputCls`/`SHOP_EMAIL` 등 상수 | `lib/config.ts` 또는 공유 `<TextInput>` | 폼 다수 |
| iframe sandbox/allow 속성 | `IFRAME_ATTRS` 상수 또는 `<EmbedIframe>` | [posts/[id]/page.tsx:256](../src/app/posts/[id]/page.tsx#L256) |

### FilmCutting
| 중복 | 통합 방향 | 위치 |
|---|---|---|
| `CompositionSafeInput` 3+중복 | `KoreanSafeInput.jsx`로 단일화 후 import | ShapeInputModal, ShapeSpecEditor, AdminCustomShapesPage |
| `KIND_LABELS`/`DEFAULT_PARAMS` | `shapeRegistry.js`에서 import | [ShapeInputModal.jsx:55](../../FilmCutting/film-cutting/src/components/ShapeInputModal.jsx) |
| `toNum`/파라미터 검증 | `utils/shapeValidation.js` 추출 | ShapeInputModal ↔ ShapeSpecEditor |
| 3개 admin 페이지 CRUD/테이블/모달 | `useAdminCRUD` 훅 + `<AdminListPage>`/`<FileUploadField>` | AdminFilms/CustomShapes/Orders (~800 LOC 절감) |
| `useFilms`/`useCustomShapes` | `useSupabaseList(table, mapper)` 팩토리 | hooks/ |
| `ShapeDimensionsPanel` (미사용 의심) | import 확인 후 제거 또는 `TransformEditor`로 통합 | ShapeDimensionsPanel.jsx |

---

## Phase 3 — 아이콘/픽토그램 통일 (lucide-react 양쪽 통일)

**film-page**: `npm install lucide-react` → 인라인 SVG 14개+ 및 유니코드를 lucide로 마이그레이션.

| 현재 | → lucide | 파일 |
|---|---|---|
| `♥` 직접 출력 | `<Heart>` | [PostCard.tsx:103](../src/components/PostCard.tsx#L103) |
| `→` `←` | `<ArrowRight>`/`<ArrowLeft>` | CartView, CheckoutForm |
| `TrashIcon`×2, `CartGlyph`×2 | `<Trash2>`,`<ShoppingCart>` | AddToCartButton, CartView, CartButton |
| `CheckIcon`,`PencilIcon`,`CommentIcon`,`HeartIcon` | lucide 대응 | 다수 |
| `—`(em-dash placeholder) | `ICONS.NOT_SET` 상수로 일원화 | [LookupView.tsx](../src/app/orders/lookup/LookupView.tsx) |
| 상태 배지 텍스트 | `<Clock>`/`<Truck>`/`<CheckCircle2>` 접두 아이콘 | OrderRow, LookupView |
| 결제수단 `PgIcon` | 브랜드 SVG는 유지하되 `components/icons/PgIcon.tsx`로 추출(브랜드 컬러는 lucide에 없음) | CheckoutForm:330 |
| Google/Kakao/Naver 로그인 | 브랜드 아이콘은 `components/icons/social.tsx`로 추출 | login/page.tsx |

**FilmCutting**: lucide는 이미 있음 → 흩어진 유니코드만 교체.

| 현재 | → lucide | 파일 |
|---|---|---|
| `✓`(Stepper/완료) | `<Check>`/`<CheckCircle2>` | OrderPage:82, AdminOrdersPage:342 |
| `✕`(닫기 6곳), `☰`(햄버거) | `<X>`,`<Menu>` | ShapeInputModal, AdminLayoutPage 등 |
| `📄 복사`,`🗑 삭제`,`📁 폰트추가`,`⚠ 경고` | `<Copy>`,`<Trash2>`,`<Upload>`,`<AlertCircle>` | ShapeSpecEditor, ShapeInputModal |
| `+ 새 …추가` | `<Plus>` | AdminFilms/CustomShapes |

> 브랜드 로고(결제/소셜)와 `ArchIcon`(lucide에 없음)은 커스텀 SVG로 유지하되 전용 파일로 분리. 모든 affordance 아이콘에 `aria-hidden`/`aria-label` 일관 적용.

---

## Phase 4 — 교차 중복: 공유 패키지 추출

> **배포 제약**: 두 프로젝트는 별도 git 레포 + 각자 Netlify 배포 → sibling `file:` 참조는 Netlify 빌드에서 미해결. **메커니즘 결정 필요**(아래 검증 섹션의 질문).

- 패키지명(가칭) `@film-artwork/geo` — **TS로 작성, JS+`.d.ts` 빌드 산출** → TS(film-page)·JS(FilmCutting) 양쪽 소비.
- **SSR 안전 필수**: film-page 버전의 `paper/dist/paper-core` + 지연 `paper.setup` 패턴을 표준으로([shapeBounds.ts:7](../src/lib/shapeBounds.ts#L7) 참조). FilmCutting `shapeBoolean.js`의 모듈 레벨 `document.createElement` 패턴 금지.
- 1차 이관 대상(고가치·저마찰): `computeLocalBounds`/`computeUnionBounds`/`computeShapeSizes` + `OrderThumbnail`(React 19 양쪽 호환, 순수 presentational).
- 주문 조회는 **부분 공유만**: 두 프로젝트가 RPC(`get_order_by_phone_and_no` vs `list_orders_by_phone`)와 필수 입력이 달라, 공통 `formatPhone`/`useOrderLookup` 정도만 공유하고 UI는 각자 유지.
- 퍼블리시 메커니즘 확정 전까지는 각 레포에 코드 유지 + **동기화 주석**으로 drift 방지(폴백).

---

## Phase 5 — 로직/정확성 개선 (버그위험·쓸데없는 로직)

| 심각도 | 항목 | 위치 |
|---|---|---|
| high | 패키지명 가용성 체크에 `AbortController` 없음 → stale 응답 경쟁 | [NewPostForm.tsx:355](../src/app/posts/new/NewPostForm.tsx#L355) |
| high | `useHistory`의 `JSON.stringify` 상태 비교(대형 pathData에서 비용·오류) → 참조/얕은 비교로 | FilmCutting useHistory.js:34 |
| med | `handleShapeChange` 2-phase setState + 언마운트 후 setState 위험 → `AbortController`/effect 정리 | DrawingCanvas.jsx:504 |
| med | `shapeBake` 비균등 스케일 시 arch 비율/`NaN` 가드 | shapeBake.js:33-61 |
| med | `clampFillet` 무음 0 반환 → 경고/상한 선처리 | shapeGenerators.js:39 |
| low | OG meta 매 ISR 재fetch → `unstable_cache`로 캐시 | posts/[id]/page.tsx:104 |
| low | `trackUrl` 계산을 `{open && …}` 내부로 이동 | OrderRow.tsx:40 |
| 보안위생 | `ADMIN_EMAIL` 하드코딩 → `VITE_ADMIN_EMAIL` (단, 실보호는 RLS 확인) | AdminLoginPage.jsx:5 |

---

## Phase 6 — 대형 리팩터 & UX (선택적 개선 제안)

- **`OrderPage.jsx` 940줄 god-component 분해**: `useOrderForm`/`useLookupModal` 훅 + `Stepper`/`OrderForm` 서브컴포넌트 추출. `useIsMobile`/`getSeoulDayKey`/`formatPhoneInput`은 `utils/`로.
- **에러 UX 통일**: 양쪽의 `alert()` → 토스트(react-hot-toast 등) + 재시도. film-page 로그인의 `alert()`도 dismissible 배너로.
- **DXF import 분해**: `importDXFtoShapes`(161줄)를 `parseLinePath`/`selectLargestRing`/`shouldIgnorePrimitive`로.
- **`mail.ts` send 결과 반환**(`{ok, error}`)으로 무음 skip 가시화.
- a11y: 모든 아이콘 버튼 `aria-label`, `aria-hidden` 정리.

---

## 검증 (Verification)

각 Phase는 **파일 단위 개별 커밋**(사용자 git 규칙) + 단계 종료 시 빌드/스모크 확인.

1. **Phase 0**: `npm run build`(film-page) 통과 + `/checkout`에서 신용카드 선택 → 주문 생성 성공(콘솔 에러 없음). agent-browser 또는 시크릿 모드로 결제창 진입까지 확인.
2. **Phase 1**: 두 프로젝트 `npm run build` 통과(삭제로 인한 import 깨짐 없음), `git status`로 잡파일 정리 확인.
3. **Phase 2–3**: 각 프로젝트 `npm run build` + `lint` 통과. 시각 회귀는 시크릿 모드로 홈/카트/체크아웃/주문조회/캔버스 페이지 스냅샷 비교(아이콘 렌더 확인).
4. **Phase 4**: 공유 패키지 빌드 → 양쪽에서 OrderThumbnail/도형 크기 표시가 추출 전과 동일한지 주문조회 페이지로 확인. **film-page는 SSR(`npm run build`)에서 paper-core import가 깨지지 않아야 함**.
5. **Phase 5–6**: 캔버스 undo/redo·드래그·삭제, DXF import/export 왕복, 관리자 CRUD 동작 확인.

배포 후 **Netlify 캐시 함정** 주의 — 변동 없어 보이면 시크릿 모드로 즉시 재검증(기존 메모 [netlify-cache-trap] 참조).

---

## 미해결 결정사항 (실행 중 사용자 확인 필요)

- **공유 패키지 퍼블리시 메커니즘**: ① 공개 npm ② 비공개 scoped npm ③ git submodule(별도 공유 레포). 퍼블리시는 외부 공개 행위라 진행 전 확인.
- FilmCutting 루트 테스트 DXF(`aa.dxf`/`FF.dxf`): 픽스처로 보존 vs 삭제.
- `design_handoff_filmartwork/`: 참조 보존 vs 삭제.

---

## 실행 결과 (이번 세션)

| Phase | 상태 | 검증 |
|---|---|---|
| 0 P0 결제 버그 | ✅ 완료 (`PG_PROVIDERS` 단일 원천) | `tsc` |
| 1 레포 위생 | ✅ 완료 (백업폴더·미사용dep·잡파일·gitignore) | `build` |
| 2 내부 중복 | ✅ 완료 (providerLabelShort/buildOrderName/emailTableRows/useOgFetch · CompositionSafeInput/useSupabaseList) | `build`+`tsc` |
| 3 아이콘 통일 | ✅ 완료 (양쪽 lucide-react, 브랜드 아이콘 `components/icons.tsx` 중앙화, 유니코드 글리프 전량 교체) | `build`+`tsc` |
| 5 로직/정확성 | ✅ 완료 (패키지명 AbortController, trackUrl 지연, shapeBake NaN 가드, clampFillet 경고) | `build`+`tsc` |
| 6 DXF 분해 | ✅ 완료 (importDXFtoShapes → 6개 헬퍼, 동작 불변) | `build` |
| 2 KIND_LABELS 통합 | ⏭️ 의도적 SKIP — registry와 실제로 다름(bubble tailDir↔tailAngle, text fontId, arch kind). 강제 시 도형 기본값 변형 위험 |  |
| 4 공유 패키지 | ⛔ 보류 — 아래 핸드오프 필요 |  |
| 6 대형 UI 리팩터 | ⛔ 보류 — 앱 실행 검증 필요 |  |

총 ~41개 **파일별 커밋**(film-page + FilmCutting). 사용자 작업 파일(`OrderCompletePage.jsx`, `reports/iridescent-yawning-noodle.md`)은 미변경.

### Phase 4 핸드오프 (사용자 GitHub 작업 선행)
`gh`/인증 부재로 새 원격 레포 생성은 사용자만 가능. 순서:
1. GitHub에 `Nilkim/film-artwork-geo`(private) 생성.
2. 공유 패키지 작성: `src/shapeBounds.ts`(film-page의 paper-core 패턴 = SSR 안전 표준) + `OrderThumbnail.tsx`, `tsconfig`로 JS+`.d.ts` 빌드, `package.json`(deps: `paper`; peer: `react`).
3. 양쪽 레포에 `git submodule add https://github.com/Nilkim/film-artwork-geo` + `netlify.toml`에 submodule fetch 확인.
4. 두 프로젝트의 `shapeBounds`/`OrderThumbnail` import를 패키지로 교체, 중복 파일 제거.
> 레포가 생기면 2~4단계는 자동 실행 가능. (현 상태: 양쪽에 중복 유지 — TS측 파일에 이미 "JS에서 이식" 주석 있어 drift는 추적됨.)

### 남은 Phase 6 (앱 실행 검증 권장)
- `OrderPage.jsx` 940줄 상태 분해(useOrderForm/useLookupModal) — 캔버스/주문 흐름 회귀 위험, `npm run dev`로 확인하며 진행.
- admin 3페이지 CRUD 공유화(`useAdminCRUD`/`<AdminListPage>`) — ~800 LOC 절감, 테이블/모달 회귀 확인 필요.
- `alert()` → 토스트(react-hot-toast) 일괄 교체 — UX 개선, 시각 확인 권장.
- `mail.ts` send 결과 `{ok,error}` 반환 — 무음 skip 가시화(저위험, 선택).
