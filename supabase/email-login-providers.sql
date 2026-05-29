-- 이메일로 기존 가입 provider 목록을 돌려주는 헬퍼 — 네이버 로그인 중복 차단용.
--
-- 사용처: src/app/api/auth/naver/userinfo/route.ts 프록시가 service-role 로 호출.
--   네이버 로그인 시 그 이메일이 *다른 provider* 계정에 이미 있으면 가입을 차단하기 위해,
--   해당 이메일 유저의 app_metadata.providers 를 읽는다.
--
-- 보안:
--   - auth.users 는 일반 클라이언트가 못 읽으므로 SECURITY DEFINER 로 감싼다.
--   - anon/authenticated 에는 실행 권한을 주지 않는다(이메일 가입 여부 노출 방지).
--     service_role 만 실행 가능 — 프록시(서버 전용)에서만 호출.
--   - search_path 고정으로 함수 하이재킹 방지.
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 1회 실행.

create or replace function public.email_login_providers(p_email text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_providers text[];
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return '{}';
  end if;

  select array(
    select jsonb_array_elements_text(u.raw_app_meta_data -> 'providers')
  )
  into v_providers
  from auth.users u
  where lower(u.email) = lower(p_email)
    and u.deleted_at is null
  order by u.created_at
  limit 1;

  return coalesce(v_providers, '{}');
end;
$$;

revoke all on function public.email_login_providers(text) from public;
revoke all on function public.email_login_providers(text) from anon;
revoke all on function public.email_login_providers(text) from authenticated;
grant execute on function public.email_login_providers(text) to service_role;
