"use client";

import React, { useState, useEffect } from "react";

export default function RegisterPage() {
  const [carList, setCarList] = useState<string[]>([]);
  const [newCarNumber, setNewCarNumber] = useState("");

  // 컴포넌트 구동 시 로컬스토리지에서 목록 불러오기
  useEffect(() => {
    const saved = localStorage.getItem("vipCars");
    if (saved) {
      try {
        setCarList(JSON.parse(saved));
      } catch (e) {
        setCarList([]);
      }
    }
  }, []);

  // 목록의 변동사항을 로컬스토리지와 동기화
  const saveToLocal = (newList: string[]) => {
    setCarList(newList);
    localStorage.setItem("vipCars", JSON.stringify(newList));
  };

  const handleAddCar = () => {
    const trimmed = newCarNumber.trim();
    if (trimmed.length < 4) {
      alert("차량 번호를 정확히 입력해주세요. (예: 17머9668)");
      return;
    }

    if (carList.includes(trimmed)) {
      alert("이미 등록된 차량 번호입니다.");
      return;
    }

    const updated = [...carList, trimmed];
    saveToLocal(updated);
    setNewCarNumber("");
  };

  const handleDeleteCar = (target: string) => {
    if (confirm(`[${target}] 차량을 지정 목록에서 삭제하시겠습니까?`)) {
      const updated = carList.filter((car) => car !== target);
      saveToLocal(updated);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#f8f9fa",
        minHeight: "100vh",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: "500px", margin: "0 auto" }}>
        <header style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "900",
              color: "#1c1e21",
              letterSpacing: "-1px",
            }}
          >
            지정 차량 관리
          </h1>
          <p style={{ color: "#6c757d", marginTop: "12px", fontSize: "16px" }}>
            특별 할인이 필요한 차량 번호를 등록하세요
          </p>
        </header>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="차량번호 (예: 17머9668)"
              value={newCarNumber}
              onChange={(e) =>
                setNewCarNumber(e.target.value.replace(/\s/g, ""))
              }
              style={{
                flex: "1",
                padding: "16px",
                fontSize: "18px",
                borderRadius: "12px",
                border: "2px solid #dee2e6",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#1c1e21")}
              onBlur={(e) => (e.target.style.borderColor = "#dee2e6")}
              onKeyDown={(e) => e.key === "Enter" && handleAddCar()}
            />
            <button
              onClick={handleAddCar}
              style={{
                padding: "0 24px",
                fontSize: "18px",
                fontWeight: "bold",
                backgroundColor: "#1c1e21",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
              }}
            >
              추가
            </button>
          </div>

          <h2
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "#495057",
              marginBottom: "16px",
              borderBottom: "1px solid #e9ecef",
              paddingBottom: "12px",
            }}
          >
            등록된 차량 목록 ({carList.length}대)
          </h2>

          {carList.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "30px 0",
                color: "#adb5bd",
              }}
            >
              등록된 등록 차량이 없습니다.
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {carList.map((car) => (
                <div
                  key={car}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    border: "1px solid #e9ecef",
                  }}
                >
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: "#1c1e21",
                    }}
                  >
                    {car}
                  </span>
                  <button
                    onClick={() => handleDeleteCar(car)}
                    style={{
                      backgroundColor: "transparent",
                      color: "#fa5252",
                      border: "1px solid #fa5252",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: "30px", textAlign: "center" }}>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              background: "transparent",
              color: "#6c757d",
              border: "none",
              fontSize: "16px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            메인 화면으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
