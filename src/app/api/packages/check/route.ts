// 패키지 이름(=package_code) 사용 가능 여부 확인.
//
// 작성 폼이 입력 중 디바운스로 호출해 실시간 중복 경고를 띄운다.
// 형식 검증도 함께 수행해 한 번에 결과를 돌려줌. (서버 액션에서도 재검증하므로
// 이 라우트는 UX용 — 보안 경계 아님)
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validatePackageName, isPackageCodeTaken } from '@/lib/orders';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim() ?? '';
  if (!code) {
    return NextResponse.json({ error: 'code required' }, { status: 400 });
  }

  const formatError = validatePackageName(code);
  if (formatError) {
    return NextResponse.json({ available: false, reason: formatError });
  }

  const supabase = await createClient();
  const taken = await isPackageCodeTaken(supabase, code);
  return NextResponse.json({
    available: !taken,
    reason: taken ? '이미 사용 중인 이름이에요.' : null,
  });
}
