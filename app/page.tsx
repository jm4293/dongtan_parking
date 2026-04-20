"use client";

import { useState } from "react";

type Step = "INPUT" | "LOADING" | "SELECT_CAR" | "DISCOUNT" | "SUCCESS";

interface Car {
  id: string;
  number: string;
  entryTime: string;
  duration: string;
}

interface AppliedCoupon {
  name: string;
  store: string;
  time: string;
}

export default function Home() {
  const [step, setStep] = useState<Step>("INPUT");
  const [carNumber, setCarNumber] = useState("");
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [appliedCoupons, setAppliedCoupons] = useState<AppliedCoupon[]>([]);

  // 1. 차량 검색 실제 API 연동 함수
  const handleSearch = async () => {
    if (carNumber.length < 2) {
      alert("차량번호를 2자리 이상 입력해주세요.");
      return;
    }
    setStep("LOADING");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carNumber })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "검색 실패");
      
      setCars(data.cars);
      setStep("SELECT_CAR");
    } catch (e: any) {
      alert("검색 오류: " + e.message);
      setStep("INPUT");
    }
  };

  // 1.5. 차량 선택 시 기등록 쿠폰 조회
  const handleSelectCar = async (car: Car) => {
    setSelectedCar(car);
    setStep("LOADING");

    try {
      const res = await fetch("/api/get-discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: car.id })
      });
      
      const data = await res.json();
      if (res.ok && data.coupons) {
        setAppliedCoupons(data.coupons);
      } else {
        setAppliedCoupons([]);
      }
    } catch (e) {
      console.error("쿠폰 조회 실패", e);
      setAppliedCoupons([]);
    }

    setStep("DISCOUNT");
  };

  // 2. 할인권 등록 실제(Mock) API 연동 함수
  const handleDiscount = async (hours: number) => {
    if (!selectedCar) return;
    
    const isConfirmed = confirm(`[${selectedCar.number}] 차량에 ${hours}시간 할인권을 등록하시겠습니까?`);
    if (!isConfirmed) return;

    setStep("LOADING");

    try {
      const res = await fetch("/api/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: selectedCar.id, targetHours: hours })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "할인 등록 실패");
      
      console.log(data.message);
      setStep("SUCCESS");
    } catch (e: any) {
      alert("오류 발생: " + e.message);
      setStep("DISCOUNT");
    }
  };

  return (
    <main style={{ padding: "40px 24px", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
      <header style={{ marginBottom: "60px", textAlign: "center" }}>
        <h1 style={{ fontSize: "36px", marginBottom: "8px" }}>주차권 할인 등록</h1>
        <p style={{ color: "#6c757d", fontSize: "18px" }}>쉽고 빠르게 주차 시간을 등록하세요</p>
      </header>

      {/* 로딩 인디케이터 (Glassmorphism + 간지나는 모션) */}
      {step === "LOADING" && (
        <div style={{ textAlign: "center", padding: "60px 0", animation: "pulse 1.5s infinite" }}>
          <div style={{ fontSize: "64px" }}>⏳</div>
          <h2 style={{ marginTop: "24px", fontSize: "28px" }}>처리 중입니다...</h2>
        </div>
      )}

      {/* 1단계: 차량 뒷번호 입력 */}
      {step === "INPUT" && (
        <div style={{ animation: "fadeIn 0.4s ease-out" }}>
          <label style={{ display: "block", fontSize: "24px", marginBottom: "16px", fontWeight: "bold" }}>
            차량번호 4자리 입력
          </label>
          <input
            type="tel"
            maxLength={4}
            value={carNumber}
            onChange={(e) => setCarNumber(e.target.value.replace(/[^0-9]/g, ""))}
            className="input-huge"
            placeholder="예) 3202"
          />
          <button onClick={handleSearch} className="btn-primary" style={{ marginTop: "16px" }}>
            검색하기
          </button>
        </div>
      )}

      {/* 2단계: 검색 결과에서 내 차 선택 */}
      {step === "SELECT_CAR" && (
        <div style={{ animation: "fadeIn 0.4s ease-out" }}>
          <h2 style={{ fontSize: "28px", marginBottom: "24px", borderBottom: "1px solid #ced4da", paddingBottom: "16px" }}>
            차량을 선택해주세요
          </h2>
          {cars.length === 0 ? (
            <div style={{ textAlign: "center", fontSize: "20px", color: "#6c757d", padding: "40px" }}>
              검색된 차량이 없습니다.
              <br /><br />
              <button 
                onClick={() => setStep("INPUT")} 
                style={{ background: "transparent", color: "#495057", border: "1px solid #adb5bd", padding: "12px 24px", borderRadius: "8px", fontSize: "18px", cursor: "pointer" }}
              >
                다시 검색
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {cars.map((car) => (
                <div
                  key={car.id}
                  onClick={() => handleSelectCar(car)}
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "24px",
                    borderRadius: "16px",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: "#1c1e21", marginBottom: "16px" }}>
                    {car.number}
                  </div>
                  
                  {/* 세로 배치로 변경하여 글자 꺾임(줄바꿈) 방지 및 시인성 극대화 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "15px", color: "#6c757d", wordBreak: "keep-all" }}>
                      입차: <span style={{ color: "#495057" }}>{car.entryTime}</span>
                    </div>
                    <div style={{ fontSize: "18px", color: "#1c1e21", fontWeight: "bold", wordBreak: "keep-all" }}>
                      주차 이용 시간: <span style={{ color: "#0056b3" }}>{car.duration}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: "24px", textAlign: "center" }}>
                <button onClick={() => setStep("INPUT")} style={{ background: "transparent", color: "#6c757d", border: "none", fontSize: "18px", padding: "16px", cursor: "pointer" }}>
                  ← 뒤로가기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3단계: 할인 적용 버튼 누르기 */}
      {step === "DISCOUNT" && selectedCar && (
        <div style={{ animation: "fadeIn 0.4s ease-out" }}>
          <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", marginBottom: "32px", textAlign: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", border: "1px solid #e9ecef" }}>
            <span style={{ fontSize: "20px", color: "#6c757d" }}>선택 차량</span>
            <div style={{ fontSize: "36px", fontWeight: "bold", marginTop: "8px" }}>{selectedCar.number}</div>
            
            {/* 기등록된 쿠폰 목록 리스트 */}
            {appliedCoupons.length > 0 && (
              <div style={{ marginTop: "16px", textAlign: "left", backgroundColor: "#f8f9fa", padding: "12px", borderRadius: "12px", border: "1px dashed #ced4da" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: "#495057", marginBottom: "8px" }}>현재 적용된 할인권 내역:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {appliedCoupons.map((coupon, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                      <span style={{ backgroundColor: "#e9ecef", color: "#495057", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" }}>
                        {coupon.name}
                      </span>
                      <span style={{ color: "#868e96", marginLeft: "8px" }}>{coupon.store}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <h2 style={{ fontSize: "24px", marginBottom: "20px" }}>주차 할인권을 선택하세요</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <button onClick={() => handleDiscount(2)} className="btn-primary">
              2시간 적용
            </button>
            <button onClick={() => handleDiscount(3)} className="btn-primary">
              3시간 적용
            </button>
            <button onClick={() => handleDiscount(4)} className="btn-primary">
              4시간 적용
            </button>
            <button onClick={() => handleDiscount(5)} className="btn-primary">
              5시간 적용
            </button>
          </div>

          <div style={{ marginTop: "40px", textAlign: "center" }}>
            <button onClick={() => setStep("SELECT_CAR")} style={{ background: "transparent", color: "#6c757d", border: "none", fontSize: "18px", padding: "16px", cursor: "pointer" }}>
              ← 다시 선택하기
            </button>
          </div>
        </div>
      )}

      {/* 성공 화면 */}
      {step === "SUCCESS" && selectedCar && (
        <div style={{ textAlign: "center", animation: "fadeIn 0.4s ease-out", padding: "60px 0" }}>
          <div style={{ fontSize: "80px", marginBottom: "24px" }}>✅</div>
          <h2 style={{ fontSize: "32px", marginBottom: "16px" }}>완료되었습니다!</h2>
          <p style={{ fontSize: "20px", color: "#6c757d", marginBottom: "40px" }}>
            [{selectedCar.number}] 차량의 주차 할인이 정상 등록되었습니다.
          </p>
          <button 
            onClick={() => {
              setCarNumber("");
              setSelectedCar(null);
              setStep("INPUT");
            }} 
            className="btn-primary"
          >
            처음으로 돌아가기
          </button>
        </div>
      )}

      {/* 간단한 인라인 CSS 애니메이션 정의 */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0% { opacity: 0.6; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.6; transform: scale(0.95); }
        }
      `}} />
    </main>
  );
}
