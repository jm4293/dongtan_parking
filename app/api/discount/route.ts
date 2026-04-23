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

    // === [특수 하드코딩 룰: 6시간, 7시간] ===
    if (requiredHours === 6) {
      // 6시간: 1시간(무료) + 5시간 할인 조합
      const coupon5 = availableCoupons.find((c: any) => c.discount_name.includes("5시간 할인") && !c.discount_name.includes("30분"));
      
      if (!hasFree1Hr && freeCoupon && coupon5) {
        couponsToApply.push(freeCoupon, coupon5);
        requiredHours = 0; // 전부 처리됨
      } else {
        // 이미 무료권을 썼다면, 1시간 유료 + 5시간 유료 합산 시도
        const coupon1 = availableCoupons.find((c: any) => c.discount_name.includes("1시간 할인") && !c.discount_name.includes("30분"));
        if (coupon1 && coupon5) {
          couponsToApply.push(coupon1, coupon5);
          requiredHours = 0;
        } else {
          return NextResponse.json({ error: "[6시간] 구성을 위한 '5시간 할인' 또는 보조 쿠폰이 서버에 없거나 적용이 불가능합니다." }, { status: 400 });
        }
      }
    } 
    else if (requiredHours === 7) {
      // 7시간: 2시간 할인 + 5시간 할인 조핪 (무료권 여부 무시)
      const coupon2 = availableCoupons.find((c: any) => c.discount_name.includes("2시간 할인") && !c.discount_name.includes("30분"));
      const coupon5 = availableCoupons.find((c: any) => c.discount_name.includes("5시간 할인") && !c.discount_name.includes("30분"));

      if (coupon2 && coupon5) {
        couponsToApply.push(coupon2, coupon5);
        requiredHours = 0;
      } else {
        return NextResponse.json({ error: "[7시간] 하드코딩 쿠폰 조합(2h+5h)을 구성할 수 없습니다." }, { status: 400 });
      }
    }

    // === [일반 로직: 1 ~ 5시간] ===
    if (requiredHours > 0) {
      // '1시간 무료'를 아직 이 차량이 하루 한도 내에서 받지 않았다면, 최대한 활용(비용 절감)
      if (!hasFree1Hr && freeCoupon && requiredHours >= 1) {
        const remainingHours = requiredHours - 1;
        
        // 혹시라도 "1시간 할인" 같은 남은 시간용 쿠폰이 매장에 있는지 미리 확인
        const hasMatchingSplitCoupon = remainingHours === 0 || availableCoupons.some((c: any) => 
          c.discount_name.includes(`${remainingHours}시간 할인`) && !c.discount_name.includes("30분")
        );

        // 정확하게 쪼갤 수 있을 때만 무료권 조합 (1시간 무료 + N시간 할인) 사용
        if (hasMatchingSplitCoupon) {
          couponsToApply.push(freeCoupon);
          requiredHours -= 1;
        }
      }

      // 남아 있는 요구 시간 적용
      if (requiredHours > 0) {
        const discountCoupon = availableCoupons.find((c: any) => 
          c.discount_name.includes(`${requiredHours}시간 할인`) && !c.discount_name.includes("30분")
        );

        if (discountCoupon) {
          couponsToApply.push(discountCoupon);
        } else {
          return NextResponse.json({ error: `[${requiredHours}시간] 짜리 할인권 코드를 시스템 메뉴에서 찾을 수 없습니다.` }, { status: 400 });
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
