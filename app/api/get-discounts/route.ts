import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

const AMANO_URL = "https://a00887.parkingweb.kr";

// 사이트는 sha256(비밀번호)를 userPwd로 요구한다. 환경변수가 평문이면 여기서 해시한다.
function toHashedPwd(raw: string): string {
  return /^[0-9a-f]{64}$/i.test(raw) ? raw : createHash('sha256').update(raw).digest('hex');
}

export async function POST(request: Request) {
  try {
    const { carId } = await request.json();

    if (!carId) {
      return NextResponse.json({ error: "차량 ID가 없습니다." }, { status: 400 });
    }

    const userId = process.env.AMANO_USER_ID;
    const userPwd = process.env.AMANO_USER_PW;

    if (!userId || !userPwd) {
      return NextResponse.json({ error: "서버 계정 정보 누락" }, { status: 500 });
    }

    // 1. 로그인
    const loginParams = new URLSearchParams();
    loginParams.append('referer', '');
    loginParams.append('userId', userId);
    loginParams.append('userPwd', toHashedPwd(userPwd));

    const loginRes = await fetch(`${AMANO_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'amano_http_ajax': 'true',
        'ajax': 'true'
      },
      body: loginParams.toString(),
      redirect: 'manual'
    });

    if (loginRes.status >= 400) {
      const loginErr = (await loginRes.text()).slice(0, 200);
      return NextResponse.json({ error: `주차 사이트 로그인 실패 (${loginRes.status}): ${loginErr}` }, { status: 502 });
    }

    const setCookieHeader = loginRes.headers.getSetCookie();
    let jsessionId = '';
    for (const cookie of setCookieHeader) {
      if (cookie.includes('JSESSIONID')) {
        jsessionId = cookie.split(';')[0];
        break;
      }
    }

    if (!jsessionId) {
       return NextResponse.json({ error: "로그인 실패" }, { status: 401 });
    }

    // 2. 할인권 상태 조회
    const getDiscountParams = new URLSearchParams();
    getDiscountParams.append('id', carId);
    getDiscountParams.append('member_id', userId);

    const detailRes = await fetch(`${AMANO_URL}/discount/registration/getForDiscount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'amano_http_ajax': 'true',
        'Cookie': jsessionId
      },
      body: getDiscountParams.toString()
    });

    const detailData = await detailRes.json();
    
    // 이 차에 어떤 할인권이 적용되었는지 검사
    const appliedCoupons = detailData.parkVisitCar || [];
    
    const formattedCoupons = appliedCoupons.map((c: any) => ({
      name: c.discount_name,
      store: c.name || "알수없음",
      time: c.create_tm
    }));

    return NextResponse.json({ success: true, coupons: formattedCoupons });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
