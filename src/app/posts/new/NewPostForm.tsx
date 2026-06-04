// 작성 폼 — Client Component.
//
// 모든 게시글은 외부 링크 기반. 내부 본문 작성 기능은 제거.
// 핵심 UX:
//   1) 전화번호로 본인 FilmCutting 주문 가져오기 → 다중 선택 → 패키지 생성
//   2) 외부 URL 입력 → OG 메타 자동 fetch → 제목 자동 채움 (수정 안 했으면 URL 바뀔 때마다 갱신)
//   3) 대표 이미지 1장 업로드 (썸네일용)
'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import dynamic from 'next/dynamic';
import { createPost } from './actions';
import { proxyIfNeeded } from '@/lib/imageProxy';
import { useOgFetch } from '@/app/posts/_useOgFetch';

// OrderThumbnail은 paper.js 의존 → SSR에서 jsdom 체인 끌어와 빌드 깨짐.
// `ssr: false`로 클라이언트에서만 로드.
const OrderThumbnail = dynamic(() => import('@/components/OrderThumbnail'), {
  ssr: false,
  loading: () => (
    <div
      className="flex-none rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
      style={{ width: 56, height: 56 }}
    />
  ),
});

// import type은 런타임에 사라져 SSR 그래프에 안 들어감.
import type { ShapeData } from '@/lib/shapeBounds';

type OrderSummary = {
  code: string;
  created_at: string;
  shapes_json: ShapeData[] | null;
  film_snapshot: { color_hex?: string; name?: string } | null;
};

const PHONE_LS_KEY = 'film_page:last_phone';

export default function NewPostForm() {
  // === 주문 패키지 ===
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  // === 패키지 이름 (작성자 입력) + 실시간 중복 체크 ===
  const [packageName, setPackageName] = useState('');
  const [pkgCheck, setPkgCheck] = useState<{
    checking: boolean;
    available: boolean | null;
    reason: string | null;
  }>({ checking: false, available: null, reason: null });
  const pkgDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // === 외부 링크 + 제목 ===
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  // URL → OG 자동 fetch (디바운스 + abort + titleDirty 게이팅) 공통 훅.
  // 작성 폼: URL 비면 OG 초기화(resetOnEmpty), 에러 시 OG 비움(resetOgOnError).
  const { og, ogLoading, ogError, titleDirty, onTitleChange, resetTitleFromOg } = useOgFetch({
    url,
    title,
    setTitle,
    resetOnEmpty: true,
    resetOgOnError: true,
  });

  // === 대표 이미지 ===
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // === 제목 & 썸네일 수정 패널 토글 ===
  // 평소엔 OG 자동 채움 + OG 이미지로 충분. 사용자가 명시적으로 펼칠 때만 수정 입력칸 노출.
  const [editorOpen, setEditorOpen] = useState(false);

  // 페이지 진입 시 마지막 사용 전화번호 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PHONE_LS_KEY);
      if (saved) setPhone(saved);
    } catch {
      /* SSR/private mode */
    }
  }, []);

  async function loadOrders() {
    if (!phone.trim()) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetch(`/api/orders?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
      setOrdersLoaded(true);
      try {
        localStorage.setItem(PHONE_LS_KEY, phone);
      } catch {
        /* noop */
      }
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : '주문 조회 실패');
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  // 패키지 이름 입력 → 디바운스 → 형식+중복 체크 (/api/packages/check)
  useEffect(() => {
    if (pkgDebounceRef.current) clearTimeout(pkgDebounceRef.current);
    const name = packageName.trim();
    if (!name) {
      setPkgCheck({ checking: false, available: null, reason: null });
      return;
    }
    setPkgCheck({ checking: true, available: null, reason: null });
    // OG fetch 와 동일 패턴 — 이전 요청을 abort 해 느린 응답이 새 입력의 결과를
    // 덮어쓰지 않게(stale availability 방지).
    const ac = new AbortController();
    pkgDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/packages/check?code=${encodeURIComponent(name)}`, { signal: ac.signal });
        const data = await res.json();
        if (ac.signal.aborted) return;
        setPkgCheck({
          checking: false,
          available: !!data.available,
          reason: data.reason ?? null,
        });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setPkgCheck({ checking: false, available: null, reason: '확인 실패 — 다시 시도해 주세요.' });
      }
    }, 500);
    return () => {
      if (pkgDebounceRef.current) clearTimeout(pkgDebounceRef.current);
      // 다음 키 입력/언마운트 시 진행 중 요청 취소.
      ac.abort();
    };
  }, [packageName]);

  function toggleOrder(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setCoverPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  const hasUrl = url.trim().length > 0;
  // 제목은 사용자가 직접 입력했거나 OG에서 자동 채워졌으면 OK.
  // 둘 다 비어있는 경우만(드물지만 사이트가 메타를 안 주는 경우) 제출 불가.
  const hasTitle = title.trim().length > 0 || og.title.length > 0;
  const pkgNameOk = packageName.trim().length > 0 && pkgCheck.available === true;
  const canSubmit = selectedCodes.size > 0 && pkgNameOk && hasUrl && hasTitle;

  return (
    <form action={createPost} className="space-y-6">
      {/* ====== 1. 주문 패키지 ====== */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          패키지 만들기
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          여러 도면을 묶어줍니다.
        </p>

        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            className={inputCls}
          />
          <button
            type="button"
            onClick={loadOrders}
            disabled={ordersLoading || !phone.trim()}
            className="shrink-0 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {ordersLoading ? '조회 중…' : '도면 조회'}
          </button>
        </div>
        {ordersError && (
          <div className="mt-2 text-xs text-red-600">조회 실패: {ordersError}</div>
        )}

        {ordersLoaded && (
          <div className="mt-3">
            {orders.length === 0 ? (
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                이 전화번호로 등록된 주문이 없어요. 필름 커팅에서 먼저 주문을 만들어 주세요.
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
                {orders.map((o) => (
                  <li key={o.code}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <input
                        type="checkbox"
                        checked={selectedCodes.has(o.code)}
                        onChange={() => toggleOrder(o.code)}
                      />
                      <OrderThumbnail
                        shapes={o.shapes_json}
                        filmColor={o.film_snapshot?.color_hex ?? '#e2e8f0'}
                        size={56}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {o.code}
                        </div>
                        {o.film_snapshot?.name && (
                          <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                            {o.film_snapshot.name}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {new Date(o.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selectedCodes.size > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from(selectedCodes).map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-900"
              >
                {c}
                <button
                  type="button"
                  onClick={() => toggleOrder(c)}
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                  aria-label="제거"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 패키지 이름 — 작성자가 직접 입력. 중복 시 경고. */}
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-900">
          <label htmlFor="package-name" className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            패키지 이름
          </label>
          <p className="mb-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            이 묶음을 부를 이름이에요. 한글·영문·숫자로 자유롭게. 다른 사람과 겹치면 안 돼요.
          </p>
          <input
            id="package-name"
            type="text"
            name="package_name"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            placeholder="예: 우리집 거실 인테리어"
            maxLength={40}
            aria-invalid={pkgCheck.available === false}
            className={inputCls}
          />
          {/* 상태 메시지: 확인 중 / 사용 가능 / 중복·형식 오류 */}
          {packageName.trim() && (
            <div className="mt-1 text-xs">
              {pkgCheck.checking ? (
                <span className="text-zinc-500">사용 가능 여부 확인 중…</span>
              ) : pkgCheck.available === true ? (
                <span className="text-green-600 dark:text-green-500">✓ 사용 가능한 이름이에요.</span>
              ) : pkgCheck.available === false ? (
                <span className="text-red-600">{pkgCheck.reason ?? '사용할 수 없는 이름이에요.'} 다른 이름을 입력해 주세요.</span>
              ) : pkgCheck.reason ? (
                <span className="text-red-600">{pkgCheck.reason}</span>
              ) : null}
            </div>
          )}
        </div>

        {Array.from(selectedCodes).map((c) => (
          <input key={c} type="hidden" name="order_codes" value={c} />
        ))}
        <input type="hidden" name="phone" value={phone} />
      </section>

      {/* ====== 2. 외부 링크 URL (필수) ====== */}
      <Field
        label="외부 링크 URL"
        hint="블로그/유튜브/인스타 등 콘텐츠 주소"
      >
        <input
          type="url"
          name="external_url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          required
          className={inputCls}
        />
        {ogLoading && <div className="mt-1 text-xs text-zinc-500">미리보기 가져오는 중…</div>}
        {ogError && <div className="mt-1 text-xs text-red-600">미리보기 실패: {ogError}</div>}
        {og.platform && (
          <div className="mt-1 text-xs text-zinc-500">
            감지된 플랫폼: <span className="font-medium">{og.platform}</span>
          </div>
        )}
      </Field>

      {(og.title || og.image) && (
        <div className="flex gap-3 overflow-hidden rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          {og.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxyIfNeeded(og.image) ?? ''} alt="" className="h-20 w-32 flex-none rounded object-cover" />
          )}
          <div className="min-w-0">
            <div className="line-clamp-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {og.title}
            </div>
            {og.description && (
              <div className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                {og.description}
              </div>
            )}
          </div>
        </div>
      )}

      {/* og_title/og_description 은 hidden input 으로 안 보냄(저작권 의도). og_image
          만 폼에서 서버로 전달 — 카드 썸네일용(사용자 결정). */}
      <input type="hidden" name="og_image" value={og.image} />
      {/* body는 사용 안 함 — 빈 문자열 전송 (DB 컬럼 NOT NULL 호환) */}
      <input type="hidden" name="body" value="" />

      {/* ====== 3. 제목 & 썸네일 수정 (접힘/펼침 토글) ======
          평소엔 OG 자동 채움 + OG 이미지로 충분 → 깔끔하게 버튼만.
          누르면 직접 제목 수정 + 대표 이미지 업로드 가능.

          주의: input들을 conditional render(mount/unmount)하면 file input의
          선택 상태가 날아간다. CSS hidden으로 감춰서 form data엔 포함되되
          시각적으로만 토글. */}
      <div>
        <button
          type="button"
          onClick={() => setEditorOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          aria-expanded={editorOpen}
        >
          <span>제목 & 썸네일 수정하기</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {editorOpen ? '▲ 접기' : '▼ 펼치기'}
          </span>
        </button>

        <div className={editorOpen ? 'mt-3 space-y-5' : 'hidden'}>
          {/* --- 제목 --- */}
          <div className="block">
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="post-title"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                제목
              </label>
              {og.title && titleDirty.current && (
                <button
                  type="button"
                  onClick={resetTitleFromOg}
                  className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                >
                  원본 제목으로 복원
                </button>
              )}
            </div>
            <input
              id="post-title"
              type="text"
              name="title"
              value={title}
              onChange={onTitleChange}
              placeholder={og.title || 'URL을 입력하면 자동으로 채워져요'}
              maxLength={200}
              className={inputCls}
            />
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              비워두면 외부 페이지 제목을 자동 사용. 직접 수정 가능.
            </div>
          </div>

          {/* --- 대표 이미지 ---
              <label>로 감싸면 라벨 텍스트 클릭만으로 파일 다이얼로그가 뜸. div로 분리. */}
          <div className="block">
            <div className="mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              대표 이미지
            </div>
            <input
              type="file"
              name="cover_image"
              accept="image/*"
              onChange={onCoverChange}
              className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-300 dark:file:bg-zinc-900 dark:file:text-zinc-300 dark:hover:file:bg-zinc-800"
            />
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              4:3 가로형 권장
            </div>
            {coverPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreview}
                alt=""
                className="mt-2 max-h-40 rounded-md border border-zinc-200 dark:border-zinc-800"
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {!canSubmit && (
          <span className="text-xs text-zinc-500">
            {selectedCodes.size === 0
              ? '주문을 1개 이상 선택해 주세요.'
              : !pkgNameOk
                ? '사용 가능한 패키지 이름을 입력해 주세요.'
                : !hasUrl
                  ? '외부 링크 URL을 입력해 주세요.'
                  : 'OG 제목을 못 가져왔어요. "제목 & 썸네일 수정하기"를 펼쳐 직접 입력해 주세요.'}
          </span>
        )}
        <SubmitButton disabled={!canSubmit} />
      </div>
    </form>
  );
}

// 게시 버튼 — useFormStatus 로 server action 진행 중인지 자동 추적.
// 클릭 후 cover 업로드/패키지 생성/INSERT/revalidate 가 직렬 실행되어 1~3초 걸리므로
// 그동안 스피너 + '게시 중…' + disabled 로 사용자에게 진행 중임을 명시.
function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending && <Spinner />}
      <span>{pending ? '게시 중…' : '게시'}</span>
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const inputCls =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-50';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </div>
      {children}
      {hint && <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>}
    </label>
  );
}
