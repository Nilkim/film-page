// 전화번호로 FilmCutting 주문 목록 조회.
//
// 클라이언트(작성 폼)가 전화번호를 입력받아 호출. 내부적으로 FilmCutting의
// `list_orders_by_phone` RPC를 호출 — film-cutting 앱의 "주문조회 버튼"과
// 동일한 결과를 돌려준다. (orders 테이블은 RLS로 막혀있고 phone 기반 RPC만 허용)
//
// 인증은 우리 측 게시판 정책에 따라 로그인 사용자만 허용.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findOrdersByPhone } from '@/lib/orders';

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone');
  if (!phone) {
    return NextResponse.json({ error: 'phone required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const orders = await findOrdersByPhone(supabase, phone);
  return NextResponse.json({ orders });
}
