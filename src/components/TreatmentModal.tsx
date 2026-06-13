import { useMemo, useState, useEffect } from "react";
import { X, Stethoscope, Pill, Users, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import {
  BREEDS, HERBS, PRESCRIPTIONS,
  SEVERITY_NAMES, SEVERITY_COLORS, DISEASE_NAMES,
  DISEASE_SYMPTOMS, ELEMENT_EMOJI, ELEMENT_NAMES,
} from "@/data/gameData";
import type { Bed, DiseaseType } from "@/types/game";

interface TreatmentModalProps {
  open: boolean;
  onClose: () => void;
  targetBed: Bed | null;
}

const SEVERITY_ORDER = ["mild", "moderate", "severe", "critical"];

function guessDiseaseFromSymptoms(symptoms: string[]): { disease: DiseaseType; match: number }[] {
  const results: { disease: DiseaseType; match: number }[] = [];
  for (const d of Object.keys(DISEASE_SYMPTOMS) as DiseaseType[]) {
    const all = DISEASE_SYMPTOMS[d];
    let matchCount = 0;
    for (const s of symptoms) {
      if (all.includes(s)) matchCount++;
    }
    results.push({ disease: d, match: matchCount / all.length });
  }
  return results.sort((a, b) => b.match - a.match).slice(0, 3);
}

export function TreatmentModal({ open, onClose, targetBed }: TreatmentModalProps) {
  const selectedBeastId = useGameStore(s => s.selectedBeastId);
  const queue = useGameStore(s => s.waitingQueue);
  const inventory = useGameStore(s => s.inventory);
  const staff = useGameStore(s => s.staff);
  const assignBedAndTreat = useGameStore(s => s.assignBedAndTreat);

  const [selectedHerbs, setSelectedHerbs] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);

  const beast = useMemo(() => queue.find(b => b.id === selectedBeastId), [queue, selectedBeastId]);
  const breed = beast ? BREEDS.find(b => b.id === beast.breedId) : null;
  const guesses = useMemo(() => beast ? guessDiseaseFromSymptoms(beast.symptoms) : [], [beast]);
  const idleStaff = useMemo(() => staff.filter(s => s.status === "idle"), [staff]);

  useEffect(() => {
    if (open) {
      setSelectedHerbs([]);
      setSelectedStaff(null);
      setShowHint(true);
    }
  }, [open, selectedBeastId]);

  if (!open || !beast || !breed) return null;

  const toggleHerb = (herbId: string) => {
    setSelectedHerbs(prev => {
      if (prev.includes(herbId)) return prev.filter(id => id !== herbId);
      if (prev.length >= 3) return prev;
      if ((inventory[herbId] ?? 0) < 1) return prev;
      return [...prev, herbId];
    });
  };

  const usePrescription = (presc: typeof PRESCRIPTIONS[number]) => {
    const enough = presc.herbIds.every(id => (inventory[id] ?? 0) >= 1);
    if (!enough) return;
    setSelectedHerbs([...presc.herbIds]);
  };

  const herbsTotal = selectedHerbs.reduce((sum, id) => {
    const h = HERBS.find(x => x.id === id);
    return sum + (h?.price ?? 0);
  }, 0);

  const canSubmit = targetBed && selectedHerbs.length >= 1;

  const handleSubmit = () => {
    if (!canSubmit || !targetBed) return;
    assignBedAndTreat(beast.id, targetBed.id, selectedStaff, selectedHerbs);
    onClose();
  };

  // 匹配到的诊断（给玩家看的诊断指南）
  const diseaseGuesses = guesses.map(g => ({
    ...g,
    presc: PRESCRIPTIONS.find(p => p.disease === g.disease),
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div
        className="bg-clinic-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border-2 border-clinic-border/60 animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-4 border-b border-clinic-border/40 bg-gradient-to-r from-clinic-jade/10 via-transparent to-clinic-amber/10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white to-gray-50 shadow-inner border border-clinic-border/50 flex items-center justify-center text-4xl flex-shrink-0">
            {breed.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-xl text-clinic-deep">{beast.name}</h3>
              <span className="text-xs text-gray-500">{breed.name}</span>
              <span>{ELEMENT_EMOJI[breed.element]} {ELEMENT_NAMES[breed.element]}系</span>
              <span className="text-[10px] text-gray-400">{"⭐".repeat(breed.rarity)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
              <span className={`tag border ${SEVERITY_COLORS[beast.severity]}`}>
                {SEVERITY_NAMES[beast.severity]}（{SEVERITY_ORDER.indexOf(beast.severity) + 1}/4）
              </span>
              <span className="tag bg-clinic-crisis/10 text-clinic-crisis border border-clinic-crisis/30">
                💊 {DISEASE_NAMES[beast.disease]}
              </span>
              <span className="text-gray-500">💝 {beast.satisfaction}</span>
              <span className="text-gray-500">⏳ 已等{beast.waitHours}h</span>
              {targetBed && (
                <span className="tag bg-clinic-amber/20 text-clinic-deep border border-clinic-amber/40 ml-auto">
                  🛏️ {targetBed.name}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-clinic-crisis hover:bg-red-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!targetBed && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              请先点击一张空闲的床位，再为这位灵兽安排诊断和治疗。
            </div>
          )}

          {/* 症状区 */}
          <div className="card p-4 border-clinic-jade/20">
            <div className="font-display text-base text-clinic-deep flex items-center gap-2 mb-2">
              <Stethoscope className="w-5 h-5 text-clinic-jade" />
              望闻问切 — 症状观察
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {beast.symptoms.map(s => (
                <span key={s} className="tag bg-white border border-clinic-jade/30 text-clinic-deep shadow-sm">
                  {s}
                </span>
              ))}
            </div>
            {showHint && diseaseGuesses.length > 0 && (
              <div className="rounded-lg bg-clinic-jade/5 border border-clinic-jade/20 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-clinic-deep flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-clinic-amber" />
                    医案参考（根据症状推测可能病症）
                  </div>
                  <button
                    onClick={() => setShowHint(false)}
                    className="text-[10px] text-gray-400 hover:text-clinic-deep"
                  >
                    隐藏提示
                  </button>
                </div>
                <div className="grid gap-1.5 md:grid-cols-3">
                  {diseaseGuesses.map((g, i) => (
                    <div
                      key={g.disease}
                      className="p-2 rounded-md bg-white/70 border border-clinic-border/40 flex flex-col"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{DISEASE_NAMES[g.disease]}</span>
                        <span className="text-[10px] text-gray-500">{Math.round(g.match * 100)}%</span>
                      </div>
                      <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            i === 0 ? "bg-clinic-jade" : i === 1 ? "bg-clinic-amber" : "bg-gray-400"
                          }`}
                          style={{ width: `${g.match * 100}%` }}
                        />
                      </div>
                      {g.presc && (
                        <button
                          onClick={() => usePrescription(g.presc!)}
                          disabled={!g.presc.herbIds.every(id => (inventory[id] ?? 0) >= 1) || !targetBed}
                          className="mt-2 text-[10px] py-1 rounded bg-clinic-jade/10 text-clinic-jade hover:bg-clinic-jade hover:text-white disabled:opacity-40 disabled:hover:bg-clinic-jade/10 disabled:hover:text-clinic-jade transition-colors"
                        >
                          使用「{g.presc.name}」
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 药材选择区 */}
          <div className="card p-4 border-clinic-amber/20">
            <div className="font-display text-base text-clinic-deep flex items-center gap-2 mb-3">
              <Pill className="w-5 h-5 text-clinic-amber" />
              处方笺 — 选择药材
              <span className="ml-auto text-xs text-gray-500">
                最多 3 味 · 已选 <span className="text-clinic-deep font-semibold">{selectedHerbs.length}</span>
              </span>
            </div>

            <div className="mb-3 text-xs flex flex-wrap gap-1">
              {PRESCRIPTIONS.map(p => (
                <button
                  key={p.id}
                  onClick={() => usePrescription(p)}
                  disabled={!p.herbIds.every(id => (inventory[id] ?? 0) >= 1) || !targetBed}
                  className="px-2 py-1 rounded-md border border-clinic-border/50 bg-white hover:border-clinic-jade hover:bg-clinic-jade/5 text-gray-700 hover:text-clinic-deep disabled:opacity-40 disabled:hover:border-clinic-border/50 disabled:hover:bg-white transition-colors flex items-center gap-1"
                  title={`${DISEASE_NAMES[p.disease]} 专用方，成功率 ${p.successRate}%`}
                >
                  <span className="text-clinic-amber">📜</span>
                  <span>{p.name}</span>
                  <span className="text-[9px] text-gray-400">({p.successRate}%)</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {HERBS.map(h => {
                const count = inventory[h.id] ?? 0;
                const selected = selectedHerbs.includes(h.id);
                const disabled = (!selected && (count < 1 || selectedHerbs.length >= 3)) || !targetBed;
                return (
                  <button
                    key={h.id}
                    onClick={() => toggleHerb(h.id)}
                    disabled={disabled}
                    className={`relative p-2 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? "border-clinic-jade bg-clinic-jade/10 shadow-glow"
                        : count > 0
                        ? "border-clinic-border/50 bg-white hover:border-clinic-jade/50 hover:shadow-md"
                        : "border-gray-200 bg-gray-50 opacity-50"
                    } ${disabled && !selected ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    <div className="text-2xl mb-1">{h.emoji}</div>
                    <div className="text-xs font-semibold text-clinic-deep">{h.name}</div>
                    <div className="text-[10px] text-gray-500 flex items-center justify-between">
                      <span>{ELEMENT_EMOJI[h.element]}</span>
                      <span>💰{h.price}</span>
                    </div>
                    <div className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 text-gray-600 tabular-nums">
                      x{count}
                    </div>
                    {selected && (
                      <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-clinic-jade text-white text-xs rounded-full flex items-center justify-center shadow-md">
                        {selectedHerbs.indexOf(h.id) + 1}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 护理员 */}
          <div className="card p-4 border-clinic-light-jade/20">
            <div className="font-display text-base text-clinic-deep flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-clinic-light-jade" />
              护理员安排
              <span className="ml-auto text-[11px] text-gray-500">
                💡 分配护理员可加速治疗 30%，成功率 +5~10%
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {idleStaff.length === 0 && (
                <div className="col-span-full text-center py-3 text-gray-400 text-sm italic">
                  暂时没有空闲的护理员，您可以不分配直接开始治疗
                </div>
              )}
              {idleStaff.map(s => {
                const sel = selectedStaff === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStaff(sel ? null : s.id)}
                    disabled={!targetBed}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all disabled:opacity-50 ${
                      sel
                        ? "border-clinic-light-jade bg-clinic-light-jade/10 shadow-glow"
                        : "border-clinic-border/50 bg-white hover:border-clinic-light-jade/60 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{s.emoji}</span>
                      <div>
                        <div className="text-sm font-semibold text-clinic-deep">{s.name}</div>
                        <div className="text-[10px] text-gray-500">{s.title} · Lv.{s.skillLevel}</div>
                      </div>
                    </div>
                    <div className="mt-1.5 text-[10px] flex items-center justify-between text-gray-500">
                      <span>成功率 +{s.skillLevel * 5}%</span>
                      <span>💰 日薪 {s.dailyWage}</span>
                    </div>
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedStaff(null)}
                disabled={!targetBed}
                className={`p-2.5 rounded-xl border-2 border-dashed transition-all disabled:opacity-50 ${
                  selectedStaff === null
                    ? "border-gray-400 bg-gray-50"
                    : "border-clinic-border/50 bg-white hover:border-gray-400"
                } flex flex-col items-center justify-center text-xs text-gray-500 hover:text-clinic-deep`}
              >
                <span className="text-xl mb-1">🙅</span>
                不分配护理员
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-clinic-border/40 bg-gradient-to-r from-clinic-amber/10 via-white to-clinic-jade/10 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <Pill className="w-4 h-4 text-clinic-amber" />
              <span>
                {selectedHerbs.length > 0
                  ? selectedHerbs.map(id => HERBS.find(h => h.id === id)?.emoji || "?").join(" + ")
                  : "未选药"}
              </span>
            </div>
            <span className="text-gray-400">·</span>
            <div className="text-clinic-deep font-semibold tabular-nums">
              💊 药材成本：{herbsTotal} 金
            </div>
            {selectedStaff && (
              <>
                <span className="text-gray-400">·</span>
                <div className="text-clinic-deep">
                  👩‍⚕️ 护理：{staff.find(s => s.id === selectedStaff)?.name}
                </div>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border-2 border-clinic-border/60 text-gray-600 hover:bg-white/80 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn-primary flex items-center gap-2 disabled:!bg-gray-300"
            >
              开始治疗
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
