// 수정 폼 — Client Component.
//
// 작성 폼(NewPostForm)과 비슷하지만 단순화:
//   - 패키지/주문번호는 불변 (한 번 정해진 묶음을 바꾸려면 새 글 작성)
//   - 전화번호 조회 UI 없음
//   - URL/제목/대표이미지만 수정 가능
//   - 기존 cover_image가 있으면 "이미지 제거" 옵션 제공
'use client';

import { useEffect, useRef, useState } from 'react';
import { updatePost } from '@/app/posts/actions';
import type { Post } from '@/lib/db';
import { proxyIfNeeded } from '@/lib/imageProxy';

type OgState = {
  title: string;
  description: string;
  image: string;
  platform: string;
};
const EMPTY_OG: OgState = { title: '', description: '', image: '', platform: '' };

export default function EditPostForm({ post }: { post: Post }) {
  const [url, setUrl] = useState(post.external_url ?? '');
  const [title, setTitle] = useState(post.title ?? '');
  const [og, setOg] = useState<OgState>({
    title: post.og_title ?? '',
    description: post.og_description ?? '',
    image: post.og_image ?? '',
    platform: post.source_platform ?? '',
  });
  const [ogLoading, setOgLoading] = useState(false);
  const [ogError, setOgError] = useState<string | null>(null);
  const ogDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOgUrl = useRef<string>(post.external_url ?? '');
  // 기존 글 로드 시점에는 사용자가 직접 손 안 댄 상태로 시작.
  const titleDirty = useRef(false);

  // 대표 이미지 관련.
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  // 사용자가 새 파일을 골랐는지. 골랐다면 "이미지 제거" 체크는 무의미.
  const [hasNewFile, setHasNewFile] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);

  // URL 변경 → 디바운스 → OG fetch
  useEffect(() => {
    if (ogDebounceRef.current) clearTimeout(ogDebounceRef.current);
    const trimmed = url.trim();
    if (!trimmed) {
      setOgError(null);
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) return;
    if (trimmed === lastOgUrl.current) return;

    ogDebounceRef.current = setTimeout(async () => {
      if (trimmed === lastOgUrl.current) return;
      lastOgUrl.current = trimmed;
      setOgLoading(true);
      setOgError(null);
      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        const next: OgState = {
          title: data.title ?? '',
          description: data.description ?? '',
          image: data.image ?? '',
          platform: data.platform ?? '',
        };
        setOg(next);
        if (!titleDirty.current && next.title) setTitle(next.title);
      } catch (e) {
        setOgError(e instanceof Error ? e.message : '미리보기 가져오기 실패');
      } finally {
        setOgLoading(false);
      }
    }, 600);

    return () => {
      if (ogDebounceRef.current) clearTimeout(ogDebounceRef.current);
    };
  }, [url]);

  function onTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    titleDirty.current = true;
    setTitle(e.target.value);
  }

  function resetTitleFromOg() {
    if (!og.title) return;
    titleDirty.current = false;
    setTitle(og.title);
  }

  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setCoverPreview(null);
      setHasNewFile(false);
      return;
    }
    setHasNewFile(true);
    setRemoveCover(false);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  const hasUrl = url.trim().length > 0;
  const hasTitle = title.trim().length > 0 || og.title.length > 0;
  const canSubmit = hasUrl && hasTitle;

  // 현재 표시할 cover 이미지 — 우선순위: 새 미리보기 > 제거 체크 > 기존 cover_image
  const currentCover = coverPreview
    ? coverPreview
    : removeCover
      ? null
      : post.cover_image;

  return (
    <form action={updatePost.bind(null, post.id)} className="space-y-6">
      {/* 패키지 (읽기 전용) */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          주문 패키지 (변경 불가)
        </div>
        <div className="mt-0.5 font-mono text-sm font-bold text-zinc-900 dark:text-zinc-50">
          {post.package_code || '—'}
        </div>
      </div>

      {/* 외부 URL */}
      <div className="block">
        <label htmlFor="edit-url" className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          외부 링크 URL
        </label>
        <input
          id="edit-url"
          type="url"
          name="external_url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
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
      </div>

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

      <input type="hidden" name="og_title" value={og.title} />
      <input type="hidden" name="og_description" value={og.description} />
      <input type="hidden" name="og_image" value={og.image} />

      {/* 제목 */}
      <div className="block">
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="edit-title" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
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
          id="edit-title"
          type="text"
          name="title"
          value={title}
          onChange={onTitleChange}
          placeholder={og.title || 'URL을 입력하면 자동으로 채워져요'}
          maxLength={200}
          className={inputCls}
        />
      </div>

      {/* 대표 이미지 */}
      <div className="block">
        <div className="mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          대표 이미지
        </div>
        {currentCover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentCover}
            alt=""
            className="mb-2 max-h-40 rounded-md border border-zinc-200 dark:border-zinc-800"
          />
        )}
        <input
          type="file"
          name="cover_image"
          accept="image/*"
          onChange={onCoverChange}
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-300 dark:file:bg-zinc-900 dark:file:text-zinc-300 dark:hover:file:bg-zinc-800"
        />
        {post.cover_image && !hasNewFile && (
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              name="remove_cover"
              value="1"
              checked={removeCover}
              onChange={(e) => setRemoveCover(e.target.checked)}
            />
            <span>현재 대표 이미지를 제거하고 OG 이미지로 돌리기</span>
          </label>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        {!canSubmit && (
          <span className="text-xs text-zinc-500">
            {!hasUrl ? '외부 링크 URL을 입력해 주세요.' : '제목이 필요해요.'}
          </span>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          저장
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-50';
