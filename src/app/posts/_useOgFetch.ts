// 외부 URL → OG 메타 자동 fetch 공통 훅.
//
// 작성 폼(NewPostForm)과 수정 폼(EditPostForm)이 거의 동일한 로직을 갖고 있어 공유.
// 핵심 동작(반드시 보존):
//   - URL 변경 시 디바운스(600ms) 후 /api/og 호출
//   - AbortController 로 진행 중 fetch 를 취소해 느린 응답이 새 URL 결과를 덮어쓰지 않게
//   - lastOgUrl 로 같은 URL 중복 fetch 방지
//   - titleDirty(사용자 수동 수정) 시 OG 제목으로 덮어쓰지 않음
//
// 두 폼의 차이는 옵션으로 흡수:
//   - initialOg / initialLastUrl : 초기 상태(수정 폼은 기존 글 값으로 seed)
//   - resetOnEmpty               : URL 이 비면 OG/lastUrl 까지 초기화(작성 폼) vs 에러만 클리어(수정 폼)
//   - resetOgOnError             : fetch 에러 시 OG 를 비움(작성 폼) vs 유지(수정 폼)
'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export type OgState = {
  title: string;
  description: string;
  image: string;
  platform: string;
};

export const EMPTY_OG: OgState = { title: '', description: '', image: '', platform: '' };

type UseOgFetchOptions = {
  url: string;
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  initialOg?: OgState;
  initialLastUrl?: string;
  resetOnEmpty?: boolean;
  resetOgOnError?: boolean;
};

export function useOgFetch({
  url,
  setTitle,
  initialOg = EMPTY_OG,
  initialLastUrl = '',
  resetOnEmpty = false,
  resetOgOnError = false,
}: UseOgFetchOptions) {
  const [og, setOg] = useState<OgState>(initialOg);
  const [ogLoading, setOgLoading] = useState(false);
  const [ogError, setOgError] = useState<string | null>(null);
  const ogDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOgUrl = useRef<string>(initialLastUrl);
  // 사용자가 제목을 직접 수정했는지 — true면 OG 제목으로 덮어쓰지 않음.
  const titleDirty = useRef(false);

  useEffect(() => {
    if (ogDebounceRef.current) clearTimeout(ogDebounceRef.current);
    const trimmed = url.trim();
    if (!trimmed) {
      if (resetOnEmpty) {
        setOg(EMPTY_OG);
        lastOgUrl.current = '';
      }
      setOgError(null);
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) return;
    if (trimmed === lastOgUrl.current) return;

    // 이전 진행 중 fetch는 cleanup에서 abort — 느린 응답이 새 URL의 결과를 덮어쓰지 않도록.
    const ac = new AbortController();

    ogDebounceRef.current = setTimeout(async () => {
      if (trimmed === lastOgUrl.current) return;
      lastOgUrl.current = trimmed;
      setOgLoading(true);
      setOgError(null);
      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(trimmed)}`, { signal: ac.signal });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        // 응답 도착 시점에 URL이 또 바뀌었으면 이 응답은 stale — 무시.
        if (ac.signal.aborted) return;
        const next: OgState = {
          title: data.title ?? '',
          description: data.description ?? '',
          image: data.image ?? '',
          platform: data.platform ?? '',
        };
        setOg(next);
        // 사용자가 직접 수정한 적 없으면 OG 제목을 항상 갱신 (URL 바꿔도 즉시 반영)
        if (!titleDirty.current && next.title) {
          setTitle(next.title);
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setOgError(e instanceof Error ? e.message : '미리보기 가져오기 실패');
        if (resetOgOnError) setOg(EMPTY_OG);
      } finally {
        if (!ac.signal.aborted) setOgLoading(false);
      }
    }, 600);

    return () => {
      if (ogDebounceRef.current) clearTimeout(ogDebounceRef.current);
      // URL이 또 바뀌면 진행 중 fetch 취소. AbortController로 race condition 방지.
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  function onTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    titleDirty.current = true;
    setTitle(e.target.value);
  }

  // "OG 제목으로 다시 채우기" — 사용자가 수동 수정 후에도 한 번에 복원 가능.
  function resetTitleFromOg() {
    if (!og.title) return;
    titleDirty.current = false;
    setTitle(og.title);
  }

  return { og, setOg, ogLoading, ogError, titleDirty, onTitleChange, resetTitleFromOg };
}
