import { NextResponse } from 'next/server';

const AMANO_URL = "https://a00887.parkingweb.kr";

export async function POST(request: Request) {
  try {
    const { carNumber } = await request.json();

    if (!carNumber || carNumber.length < 2) {
      return NextResponse.json({ error: "차량번호를 확인해주세요." }, { status: 400 });
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
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

    // 2. 차량 검색 API 호출
    // AMANO 시스템은 입차일자(entryDate) 기준으로 검색하므로, 
    // 새벽시간 검색 편의를 위해 사이트 정책과 동일하게 '하루 전(전일)'부터 검색합니다.
    const searchDate = new Date();
    // UTC to KST
    searchDate.setHours(searchDate.getHours() + 9);
    searchDate.setDate(searchDate.getDate() - 1);
    
    const yyyy = searchDate.getFullYear().toString();
    const mm = (searchDate.getMonth() + 1).toString().padStart(2, '0');
    const dd = searchDate.getDate().toString().padStart(2, '0');
    const entryDate = yyyy + mm + dd;

    const searchParams = new URLSearchParams();
    searchParams.append('iLotArea', '10');
    searchParams.append('entryDate', entryDate);
    searchParams.append('carNo', carNumber);

    const searchRes = await fetch(`${AMANO_URL}/discount/registration/listForDiscount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'amano_http_ajax': 'true',
        'Cookie': jsessionId
      },
      body: searchParams.toString()
    });

    const dataText = await searchRes.text();
    let data;
    try {
      data = JSON.parse(dataText);
    } catch(e) {
      return NextResponse.json({ error: "검색 결과를 파싱할 수 없습니다." }, { status: 500 });
    }

    // data is an array of cars
    // 예: [ {"id": 337420, "carNo": "39주3898", "entryDateToString": "2026-04-20 17:28:00"} ]
    const cars = data.map((c: any) => {
      let durationStr = "";
      if (c.entryDateToString) {
        // 강제로 한국 시간(KST)으로 파싱
        const entryStr = c.entryDateToString.replace(" ", "T") + "+09:00";
        const entryMs = new Date(entryStr).getTime();
        const diffMins = Math.floor((Date.now() - entryMs) / 60000);
        
        if (diffMins >= 0) {
          const h = Math.floor(diffMins / 60);
          const m = diffMins % 60;
          durationStr = h > 0 ? `${h}시간 ${m}분` : `${m}분`;
        } else {
          durationStr = "알수없음";
        }
      }

      return {
        id: c.id.toString(),
        number: c.carNo,
        entryTime: c.entryDateToString,
        duration: durationStr
      };
    });

    return NextResponse.json({ success: true, cars });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
