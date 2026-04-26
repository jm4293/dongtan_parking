import { NextResponse } from 'next/server';

const AMANO_URL = "https://a00887.parkingweb.kr";

type DiscountRequest = {
  carId: string;
  targetHours: number; 
};

export async function POST(request: Request) {
  try {
    const { carId, targetHours } = await request.json();

    if (!carId || !targetHours) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userId = process.env.AMANO_USER_ID;
    const userPwd = process.env.AMANO_USER_PW;

    if (!userId || !userPwd) {
      return NextResponse.json({ error: "서버 환경설정에 계정 정보가 없습니다." }, { status: 500 });
    }

    // 1. 로그인하여 JSESSIONID 확보
    const loginParams = new URLSearchParams();
    loginParams.append('referer', '');
    loginParams.append('userId', userId);
    loginParams.append('userPwd', userPwd);

    const loginRes = await fetch(`${AMANO_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: loginParams.toString(),
      redirect: 'manual'
    });

    const setCookieHeader = loginRes.headers.getSetCookie();
    let jsessionId = '';
    for (const cookie of setCookieHeader) {
      if (cookie.includes('JSESSIONID')) {
        jsessionId = cookie.split(';')[0];
        break;
      }
    }

    if (!jsessionId) {
       return NextResponse.json({ error: "AMANO 로그인에 실패했습니다." }, { status: 401 });
    }

    // 2. 할인권 상태 조회 (기등록 쿠폰 및 쿠폰 ID 확보)
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
    
    // 이 차에 어떤 할인권이 적용되었는지 검사 (배열 구조 기준)
    // parkVisitCar는 이미 등록된 쿠폰 배열 (다른 사업장 등 전체 내역)
    const appliedCoupons = detailData.parkVisitCar || [];
    const hasFree1Hr = appliedCoupons.some((coupon: any) => coupon.discount_name && coupon.discount_name.includes("1시간 무료"));
    
    // 등록할 수 있는 모든 쿠폰 목록 (discount_name -> id 맵핑)
    const availableCoupons = detailData.listDiscountType || [];

    let requiredHours = targetHours;
    const couponsToApply = [];
    const freeCoupon = availableCoupons.find((c: any) => c.discount_name.includes("1시간 무료"));

    const findCoupon = (hours: number) => {
      if (hours === 0) return null;
      if (hours % 1 === 0) {
        return availableCoupons.find((c: any) => c.discount_name.includes(`${hours}시간 할인`) && !c.discount_name.includes("30분"));
      } else {
        const h = Math.floor(hours);
        if (h === 0) return availableCoupons.find((c: any) => c.discount_name.includes(`30분 할인`));
        return availableCoupons.find((c: any) => c.discount_name.includes(`${h}시간 30분 할인`));
      }
    };

    // === [할인권 하드코딩 및 일반 룰 조합] ===
    if (requiredHours === 5.5) {
      // 5.5시간: 1시간 30분 할인 + 4시간 할인
      const c1_5 = findCoupon(1.5);
      const c4 = findCoupon(4);
      if (c1_5 && c4) {
        couponsToApply.push(c1_5, c4);
        requiredHours = 0;
      } else {
        return NextResponse.json({ error: "[5.5시간] 조합을 위한 '1시간 30분' 또는 '4시간' 쿠폰이 없습니다." }, { status: 400 });
      }
    } 
    else if (requiredHours === 6) {
      // 6시간: 1시간 무료 + 5시간 할인
      const c5 = findCoupon(5);
      if (!hasFree1Hr && freeCoupon && c5) {
        couponsToApply.push(freeCoupon, c5);
        requiredHours = 0;
      } else if (hasFree1Hr && c5) {
        // 이미 무료 사용했으면 1시간 유료 + 5시간 유료 시도
        const c1 = findCoupon(1);
        if (c1 && c5) {
          couponsToApply.push(c1, c5);
          requiredHours = 0;
        } else {
          return NextResponse.json({ error: "[6시간] 무료권 소진 후 1시간 유료+5시간 유료 조합에 실패했습니다." }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: "[6시간] 구성을 위한 '5시간 할인' 쿠폰이 없습니다." }, { status: 400 });
      }
    }
    else if (requiredHours === 7) {
      // 7시간: 2시간 할인 + 5시간 할인
      const c2 = findCoupon(2);
      const c5 = findCoupon(5);
      if (c2 && c5) {
        couponsToApply.push(c2, c5);
        requiredHours = 0;
      } else {
        return NextResponse.json({ error: "[7시간] 하드코딩 쿠폰 조합(2h+5h)을 구성할 수 없습니다." }, { status: 400 });
      }
    }
    else if (requiredHours > 0) {
      // 1 ~ 5 시간 구간 (0.5 단위 포함)
      if (requiredHours <= 1) {
        if (!hasFree1Hr && freeCoupon) {
          couponsToApply.push(freeCoupon);
        } else if (!hasFree1Hr) {
          const cMatch = findCoupon(requiredHours);
          if (cMatch) couponsToApply.push(cMatch);
        }
      } else {
        const paidHours = requiredHours - 1;
        
        if (!hasFree1Hr && freeCoupon) {
          couponsToApply.push(freeCoupon);
        }
        
        if (paidHours > 0) {
          const cPaid = findCoupon(paidHours);
          if (cPaid) {
            couponsToApply.push(cPaid);
          } else {
            if (!hasFree1Hr && !freeCoupon) {
              const cFull = findCoupon(requiredHours);
              if (cFull) {
                couponsToApply.push(cFull);
              } else {
                return NextResponse.json({ error: `[${requiredHours}시간] 단일 할인권도 찾을 수 없습니다.` }, { status: 400 });
              }
            } else {
              return NextResponse.json({ error: `[${paidHours}시간] 추가 할인권을 찾을 수 없습니다.` }, { status: 400 });
            }
          }
        }
      }
    }

    if (couponsToApply.length === 0) {
      return NextResponse.json({ 
        message: "이미 해당 시간만큼 할인이 적용되어 추가 등록이 필요하지 않습니다."
      });
    }

    // 4. 조합된 쿠폰들을 순차적으로 서버에 Save 전송
    const parkEntry = detailData.parkEntry;
    
    for (const coupon of couponsToApply) {
      const saveParams = new URLSearchParams();
      saveParams.append('peId', parkEntry.iID);
      saveParams.append('carNo', parkEntry.acPlate1);
      saveParams.append('discountType', coupon.id);
      saveParams.append('memo', '자동 모바일 등록');

      await fetch(`${AMANO_URL}/discount/registration/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'amano_http_ajax': 'true',
          'Cookie': jsessionId
        },
        body: saveParams.toString()
      });

      // AMANO 서버 부하 및 동시성 락 방지를 위해 500ms 대기
      await new Promise(r => setTimeout(r, 500));
    }

    const appliedNames = couponsToApply.map((c: any) => c.discount_name).join(' + ');

    return NextResponse.json({
      success: true,
      message: `성공! 적용된 쿠폰: ${appliedNames}`
    });

  } catch (err: any) {
    return NextResponse.json({ error: `할인 등록 실패: ${err.message}` }, { status: 500 });
  }
}
