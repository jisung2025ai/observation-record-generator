"use client";

import { useState } from "react";
import { Copy, Loader2, Play } from "lucide-react";
import { OBSERVATION_ITEMS } from "./data/items";

export default function Home() {
  const [domain, setDomain] = useState("신체운동·건강");
  const [item, setItem] = useState("1");
  const [level, setLevel] = useState("1");
  const [situationKeyword, setSituationKeyword] = useState("");
  const [activityKeyword, setActivityKeyword] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copiedObs, setCopiedObs] = useState(false);
  const [copiedEval, setCopiedEval] = useState(false);

  const maxItems = domain === "예술경험" ? 10 : domain === "자연탐구" ? 13 : 12;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!situationKeyword) {
      alert("상황 키워드를 입력해주세요.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          item,
          level,
          situationKeyword,
          activityKeyword,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setResult(data.draft);
      } else {
        alert("오류가 발생했습니다: " + data.error);
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, type: 'obs' | 'eval') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'obs') {
      setCopiedObs(true);
      setTimeout(() => setCopiedObs(false), 2000);
    } else {
      setCopiedEval(true);
      setTimeout(() => setCopiedEval(false), 2000);
    }
  };

  let observation = result;
  let evaluation = "";

  const evalRegex = /(?:\[|\*\*)?\s*평가\s*및\s*지원계획(?:\]|\*\*)?:?\s*/;
  const match = result.match(evalRegex);

  if (match && match.index !== undefined) {
    observation = result.substring(0, match.index).trim();
    evaluation = result.substring(match.index + match[0].length).trim();

    // Clean up observation header
    observation = observation.replace(/^(?:\[|\*\*)?\s*관찰내용(?:\]|\*\*)?:?\s*/, "").trim();
  } else {
    // Fallback: Check if it used "배움지원" or "평가"
    const fallbackMatch = result.match(/(?:\[|\*\*)?\s*(?:평가\(배움지원\)|배움지원|평가(?:분석)?)(?:\]|\*\*)?:?\s*/);
    if (fallbackMatch && fallbackMatch.index !== undefined && fallbackMatch.index > 0) {
      observation = result.substring(0, fallbackMatch.index).trim();
      evaluation = result.substring(fallbackMatch.index + fallbackMatch[0].length).trim();
      observation = observation.replace(/^(?:\[|\*\*)?\s*관찰내용(?:\]|\*\*)?:?\s*/, "").trim();
    }
  }

  // Remove NotebookLM citation markers (e.g. "[1]", "[1, 2]", "[1-3]")
  observation = observation.replace(/\[\d+(?:,\s*\d+|-\d+)*\]/g, "");
  evaluation = evaluation.replace(/\[\d+(?:,\s*\d+|-\d+)*\]/g, "");

  // Remove trailing stray numbers from generation (e.g. "한다1." -> "한다.")
  observation = observation.replace(/(?<=[가-힣a-zA-Z])\d+(?=[.!?,;:]*(?:\s|$))/g, "");
  evaluation = evaluation.replace(/(?<=[가-힣a-zA-Z])\d+(?=[.!?,;:]*(?:\s|$))/g, "");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 md:p-12">
      <main className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-4 pt-10 pb-8">
          <div className="inline-block p-3 bg-blue-100 rounded-2xl mb-2">
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
            관찰기록 초안 생성기
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            누리과정 및 유아관찰척도 기준에 맞춰 빠르고 정확하게 관찰기록 초안을 생성해보세요.
          </p>
        </header>

        <div className="grid md:grid-cols-12 gap-8">
          {/* Input Form Section */}
          <div className="md:col-span-7 bg-white p-6 md:p-8 rounded-3xl shadow-sm ring-1 ring-gray-100">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-sm font-semibold text-gray-700">영역</label>
                  <select
                    value={domain}
                    onChange={(e) => {
                      const newDomain = e.target.value;
                      setDomain(newDomain);
                      const newMaxItems = newDomain === "예술경험" ? 10 : newDomain === "자연탐구" ? 13 : 12;
                      if (parseInt(item) > newMaxItems) {
                        setItem("1");
                      }
                    }}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none transition-all"
                  >
                    <option value="신체운동·건강">신체운동·건강</option>
                    <option value="의사소통">의사소통</option>
                    <option value="사회관계">사회관계</option>
                    <option value="예술경험">예술경험</option>
                    <option value="자연탐구">자연탐구</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">문항</label>
                  <select
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none transition-all"
                  >
                    {Array.from({ length: maxItems }, (_, i) => i + 1).map((num) => {
                      const itemText = OBSERVATION_ITEMS[domain]?.[String(num)]?.text || "";
                      return (
                        <option key={num} value={String(num)}>
                          {num}문항 - {itemText}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700">관찰 수준</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((lvl) => {
                    const levelStr = String(lvl);
                    return (
                      <label
                        key={levelStr}
                        className={
                          "cursor-pointer text-center py-3 rounded-xl border text-sm font-medium transition-all duration-200 " +
                          (level === levelStr
                            ? "bg-blue-600 text-white border-blue-600 shadow-md"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")
                        }
                      >
                        <input
                          type="radio"
                          name="level"
                          value={levelStr}
                          checked={level === levelStr}
                          onChange={(e) => setLevel(e.target.value)}
                          className="hidden"
                        />
                        {lvl}수준
                      </label>
                    );
                  })}
                </div>
                {OBSERVATION_ITEMS[domain]?.[item]?.levels?.[level as "1" | "2" | "3" | "4"] && (
                  <div className="mt-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                    <p className="text-[13px] text-gray-600 leading-relaxed">
                      <span className="font-semibold text-blue-700 mr-1">설명:</span>
                      {OBSERVATION_ITEMS[domain][item].levels[level as "1" | "2" | "3" | "4"]}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    관찰 상황 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={situationKeyword}
                    onChange={(e) => setSituationKeyword(e.target.value)}
                    placeholder="예: 놀이, 일상생활, 활동"
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">키워드 (선택)</label>
                  <input
                    type="text"
                    value={activityKeyword}
                    onChange={(e) => setActivityKeyword(e.target.value)}
                    placeholder="예: 병원놀이, 블록놀이, 간식"
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl p-4 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-gray-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    작성 중...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    초안 생성하기
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Result Section */}
          <div className="md:col-span-5 flex flex-col h-full gap-6">

            {/* Observation Box */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/30 p-6 md:p-8 rounded-3xl flex-1 border border-blue-100 flex flex-col shadow-inner min-h-[300px]">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                관찰 내용
              </h2>

              <div className="flex-1 bg-white/60 backdrop-blur-sm rounded-2xl border border-white p-5 shadow-sm relative overflow-hidden flex flex-col">
                {loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                    <p className="text-sm font-medium animate-pulse">NotebookLM 분석 중...</p>
                  </div>
                ) : observation ? (
                  <div className="flex-1 relative group">
                    <p className="text-gray-700 leading-relaxed text-[15px] whitespace-pre-wrap">{observation}</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-center p-6">
                    <p className="text-gray-400 text-sm">
                      좌측 폼에 정보를 입력하고
                      <br />
                      생성 버튼을 눌러주세요.
                    </p>
                  </div>
                )}

                <div className="mt-auto pt-4 flex justify-end">
                  <button
                    onClick={() => copyText(observation, 'obs')}
                    disabled={!observation || loading}
                    className={
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all " +
                      (observation && !loading
                        ? "bg-white border hover:bg-gray-50 text-gray-700 shadow-sm active:scale-95"
                        : "opacity-0 pointer-events-none")
                    }
                  >
                    {copiedObs ? (
                      <span className="text-green-600 font-semibold">복사완료!</span>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        복사
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Evaluation Box */}
            <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50/30 p-6 md:p-8 rounded-3xl flex-1 border border-purple-100 flex flex-col shadow-inner min-h-[300px]">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                평가(배움지원)
              </h2>

              <div className="flex-1 bg-white/60 backdrop-blur-sm rounded-2xl border border-white p-5 shadow-sm relative overflow-hidden flex flex-col">
                {loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    <p className="text-sm font-medium animate-pulse">NotebookLM 분석 중...</p>
                  </div>
                ) : evaluation ? (
                  <div className="flex-1 relative group">
                    <p className="text-gray-700 leading-relaxed text-[15px] whitespace-pre-wrap">{evaluation}</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-center p-6">
                    <p className="text-gray-400 text-sm">
                      결과가 생성되면 배움지원 계획이
                      <br />
                      이곳에 표시됩니다.
                    </p>
                  </div>
                )}

                <div className="mt-auto pt-4 flex justify-end">
                  <button
                    onClick={() => copyText(evaluation, 'eval')}
                    disabled={!evaluation || loading}
                    className={
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all " +
                      (evaluation && !loading
                        ? "bg-white border hover:bg-gray-50 text-gray-700 shadow-sm active:scale-95"
                        : "opacity-0 pointer-events-none")
                    }
                  >
                    {copiedEval ? (
                      <span className="text-green-600 font-semibold">복사완료!</span>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        복사
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
