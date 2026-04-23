import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const adminPin = process.env.ADMIN_PIN;

    if (!adminPin) {
      // 서버에 PIN이 설정되지 않은 경우 (보안상 에러 반환)
      return NextResponse.json({ success: false, error: "서버 관리자 비밀번호가 설정되지 않았습니다." }, { status: 500 });
    }

    if (password === adminPin) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
}
