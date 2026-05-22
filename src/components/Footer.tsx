// 사이트 푸터 — COTYLEDON 회사/입금 정보. (FilmArtwork 라이트 디자인)
//
// 좌측 BANK ACCOUNT + 우측 COMPANY INFO 2열, 하단 copyright.
// 모바일에서는 세로 스택. 라벨은 ink, 값은 ink-60 톤.
const COMPANY = {
  bankName: '기업은행',
  bankAccount: '119-194172-04-013',
  holder: '(주)코틸레돈',
  name: '(주)코틸레돈',
  owner: '김현구',
  cpo: '01040091026',
  email: 'cotyledon79@naver.com',
  tel: '01040091026',
  openTime: '09:00 ~ 18:00',
  orderLicense: '제2020-경기김포-2948호',
  bizLicense: '7588601913',
  address: '10045 경기 김포시 대곶면 황금1로 348-1 코틸레돈 COTYLEDON',
};

// 공정위 사업자정보 공개 팝업 — 사업자등록번호로 조회.
const BIZ_INFO_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${COMPANY.bizLicense}`;

export default function Footer() {
  return (
    <footer className="border-t border-ink pb-8 pt-10 text-[12px] leading-relaxed">
      <div className="grid gap-x-12 gap-y-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* BANK ACCOUNT */}
        <section>
          <h3 className="mb-3 text-[13px] font-bold tracking-[0.04em] text-ink">BANK ACCOUNT</h3>
          {/* dl을 grid로 — Row는 dt/dd를 직접 자식으로 내보내 라벨 컬럼 폭이 섹션 내 통일됨 */}
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
            <Row label="C.P.O">{COMPANY.cpo}</Row>
            <Row label="E-mail">
              <a href={`mailto:${COMPANY.email}`} className="hover:text-ink hover:underline">
                {COMPANY.email}
              </a>
            </Row>
            <Row label="TEL">{COMPANY.tel}</Row>
            <Row label="OPEN TIME">{COMPANY.openTime}</Row>
            <Row label="ORDER LICENSE">
              {COMPANY.orderLicense}{' '}
              <a
                href={BIZ_INFO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-terracotta hover:underline"
              >
                [사업자정보확인]
              </a>
            </Row>
            <Row label="BUSINESS LICENSE">{COMPANY.bizLicense}</Row>
            <Row label="ADDRESS">{COMPANY.address}</Row>
          </dl>
        </section>
      </div>

      <div className="mt-8 text-[11px] tracking-[0.06em] text-ink-45">
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
