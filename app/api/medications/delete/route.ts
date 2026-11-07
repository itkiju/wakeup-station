import { NextResponse } from "next/server";

// 복약 일정 삭제는 버전 기반 전체 동기화 API에서 처리합니다.
// 이전 방식의 직접 삭제 요청은 데이터 충돌을 방지하기 위해 차단합니다.

export async function POST() {
  return NextResponse.json(
    {
      error: "이전 삭제 API는 비활성화되었습니다. 복약 일정 동기화를 이용해 주세요.",
    },
    { status: 410 }
  );
}
