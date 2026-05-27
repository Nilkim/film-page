// 사이트 푸터 — COTYLEDON 회사/입금 정보. (FilmArtwork 라이트 디자인)
//
// 좌측 BANK ACCOUNT + 우측 COMPANY INFO 2열, 하단 copyright + 약관 링크.
// 모바일에서는 세로 스택. 라벨은 ink, 값은 ink-60 톤.
//
// 통신판매업 사이트 표준에 맞춰 OWNER/BUSINESS LICENSE 노출 + 약관/개인정보/환불정책
// 페이지 링크를 두어 결제 PG(포트원) 심사 요건을 충족.
import Link from 'next/link';

const COMPANY = {
  bankName: '기업은행',
  bankAccount: '119-194172-04-013',
  holder: '(주)코틸레돈',
  name: '(주)코틸레돈',
  owner: '김현구',
  email: 'cotyledon79@naver.com',
  tel: '010-4009-1026',
  openTime: '09:00 ~ 18:00',
  orderLicense: '제2020-경기김포-2948호',
  bizLicense: '758-86-01913',
  address: '10045 경기 김포시 대곶면 황금1로 348-1 코틸레돈 COTYLEDON',
};

// 공정위 사업자정보 공개 팝업 — 사업자등록번호로 조회. 하이픈은 제거.
const BIZ_INFO_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${COMPANY.bizLicense.replace(/-/g, '')}`;

export default function Footer() {
  return (
    <footer className="border-t border-ink pb-8 pt-10 text-[12px] leading-relaxed">
      <div className="grid gap-x-12 gap-y-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* BANK ACCOUNT */}
        <section>
          <h3 className="mb-3 text-[13px] font-bold tracking-[0.04em] text-ink">BANK ACCOUNT</h3>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
            <Row label={COMPANY.bankName}>{COMPANY.bankAccount}</Row>
            <Row label="예금주">{COMPANY.holder}</Row>
          </dl>
        </section>

        {/* COMPANY INFO */}
        <section>
          <h3 className="mb-3 text-[13px] font-bold tracking-[0.04em] text-ink">COMPANY INFO</h3>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
            <Row label="COMPANY">{COMPANY.name}</Row>
            <Row label="OWNER">{COMPANY.owner}</Row>
            <Row label="E-mail">
              <a href={`mailto:${COMPANY.email}`} className="hover:text-ink hover:underline">
                {COMPANY.email}
              </a>
            </Row>
            <Row label="TEL">
              <a href={`tel:${COMPANY.tel.replace(/-/g, '')}`} className="hover:text-ink hover:underline">
                {COMPANY.tel}
              </a>
            </Row>
            <Row label="OPEN TIME">{COMPANY.openTime}</Row>
            <Row label="BUSINESS LICENSE">
              {COMPANY.bizLicense}{' '}
              <a
                href={BIZ_INFO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-terracotta hover:underline"
              >
                [사업자정보확인]
              </a>
            </Row>
            <Row label="ORDER LICENSE">{COMPANY.orderLicense}</Row>
            <Row label="ADDRESS">{COMPANY.address}</Row>
          </dl>
        </section>
      </div>

      {/* 약관·정책 링크 — 결제 PG 심사 요건. 모바일에서도 한 줄에 들어가도록 작게. */}
      <nav className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tracking-[0.04em] text-ink-60">
        <Link href="/legal/terms" className="hover:text-ink hover:underline">이용약관</Link>
        <span className="text-ink-10" aria-hidden="true">·</span>
        <Link href="/legal/privacy" className="font-semibold hover:text-ink hover:underline">개인정보처리방침</Link>
        <span className="text-ink-10" aria-hidden="true">·</span>
        <Link href="/legal/refund" className="hover:text-ink hover:underline">환불·취소 정책</Link>
        <span className="text-ink-10" aria-hidden="true">·</span>
        <Link href="/orders/lookup" className="hover:text-ink hover:underline">주문조회</Link>
      </nav>

      <div className="mt-3 text-[11px] tracking-[0.06em] text-ink-45">
        Copyright COTYLEDON All right reserved
      </div>
    </footer>
  );
}

// dt/dd를 fragment로 — 부모 dl(grid)의 직접 자식이 되어 라벨 컬럼 폭이 통일됨.
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="tracking-[0.04em] text-ink-45">{label}</dt>
      <dd className="text-ink-60">{children}</dd>
    </>
  );
}
