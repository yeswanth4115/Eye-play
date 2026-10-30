import React, { useState } from 'react';
import { AdultEvaluationRecord, EvaluationPartA, EvaluationPartB, EvaluationPartC } from '../../types';
import {
  createDefaultEvaluation,
  researchEvaluationService,
} from '../../services/researchEvaluationService';
import { sessionStorageService } from '../../services/sessionStorageService';

interface ResearchEvaluationViewProps {
  onClose: () => void;
  participantPseudonym?: string;
  sessionId?: string;
}

export const ResearchEvaluationView: React.FC<ResearchEvaluationViewProps> = ({
  onClose,
  participantPseudonym = '',
  sessionId,
}) => {
  const [activeTab, setActiveTab] = useState<'PART_A' | 'PART_B' | 'PART_C' | 'RESULTS'>('PART_A');
  const [evaluation, setEvaluation] = useState<AdultEvaluationRecord>(() =>
    createDefaultEvaluation(participantPseudonym, sessionId)
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  // PART A HANDLERS
  const handleSelectOptionA = (scenarioId: string, optionId: string) => {
    setEvaluation((prev) => {
      const updated = prev.partA.scenarios.map((s) => (s.id === scenarioId ? { ...s, selectedOptionId: optionId } : s));
      return { ...prev, partA: { ...prev.partA, scenarios: updated } };
    });
  };

  const handleConfidenceChangeA = (scenarioId: string, confidence: number) => {
    setEvaluation((prev) => {
      const updated = prev.partA.scenarios.map((s) => (s.id === scenarioId ? { ...s, confidence } : s));
      return { ...prev, partA: { ...prev.partA, scenarios: updated } };
    });
  };

  // PART B HANDLERS
  const handleDecisionChangeB = (caseId: string, decision: string) => {
    setEvaluation((prev) => {
      const updated = prev.partB.cases.map((c) => (c.id === caseId ? { ...c, selectedDecision: decision } : c));
      return { ...prev, partB: { ...prev.partB, cases: updated } };
    });
  };

  const handleReasoningChangeB = (caseId: string, reasoning: string) => {
    setEvaluation((prev) => {
      const updated = prev.partB.cases.map((c) => (c.id === caseId ? { ...c, reasoning } : c));
      return { ...prev, partB: { ...prev.partB, cases: updated } };
    });
  };

  const handleUncertaintyToggleB = (caseId: string, uncertaintyExpressed: boolean) => {
    setEvaluation((prev) => {
      const updated = prev.partB.cases.map((c) => (c.id === caseId ? { ...c, uncertaintyExpressed } : c));
      return { ...prev, partB: { ...prev.partB, cases: updated } };
    });
  };

  const handleAdditionalInfoChangeB = (caseId: string, additionalInfoRequested: string) => {
    setEvaluation((prev) => {
      const updated = prev.partB.cases.map((c) => (c.id === caseId ? { ...c, additionalInfoRequested } : c));
      return { ...prev, partB: { ...prev.partB, cases: updated } };
    });
  };

  // PART C HANDLERS
  const handleLikertChangeC = (field: keyof EvaluationPartC['likertRatings'], value: number) => {
    setEvaluation((prev) => ({
      ...prev,
      partC: {
        ...prev.partC,
        likertRatings: { ...prev.partC.likertRatings, [field]: value },
      },
    }));
  };

  const handleOpenResponseChangeC = (field: keyof EvaluationPartC['openResponses'], value: string) => {
    setEvaluation((prev) => ({
      ...prev,
      partC: {
        ...prev.partC,
        openResponses: { ...prev.partC.openResponses, [field]: value },
      },
    }));
  };

  const handleSaveEvaluation = () => {
    researchEvaluationService.saveEvaluation(evaluation);
    setSavedSuccess(true);
    setActiveTab('RESULTS');
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportCsv = () => {
    const csv = researchEvaluationService.exportEvaluationsAsCsv([evaluation]);
    sessionStorageService.downloadFile(csv, `research_eval_${evaluation.id}.csv`, 'text/csv');
  };

  const handleExportJson = () => {
    const json = researchEvaluationService.exportEvaluationsAsJson([evaluation]);
    sessionStorageService.downloadFile(json, `research_eval_${evaluation.id}.json`, 'application/json');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-100 overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 font-bold border border-sky-500/20">
            🔬
          </span>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Adult Evaluation Research Workflow</h1>
            <p className="text-xs text-slate-400">
              Researcher-developed instrument · Participant: {evaluation.participantPseudonym || 'Unlinked'}
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-800 p-1 border border-slate-700 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('PART_A')}
            className={`rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${
              activeTab === 'PART_A' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Part A: Report Understanding
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PART_B')}
            className={`rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${
              activeTab === 'PART_B' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Part B: Adjustment Decisions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PART_C')}
            className={`rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${
              activeTab === 'PART_C' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Part C: Adult Feedback
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('RESULTS')}
            className={`rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${
              activeTab === 'RESULTS' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Summary & Export 📊
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveEvaluation}
            className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
          >
            Save Record
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            Close (Esc)
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-5xl flex-1 p-6 space-y-6">
        {/* PART A: REPORT UNDERSTANDING */}
        {activeTab === 'PART_A' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
                Component A: Report Understanding & Confidence Calibration
              </h2>
              <p className="text-xs text-slate-400">
                Tests comprehension of gaze measures and compares evaluator confidence against objective interpretation criteria.
              </p>
            </div>

            <div className="space-y-4">
              {evaluation.partA.scenarios.map((scenario, idx) => (
                <div key={scenario.id} className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-sky-400">Scenario {idx + 1}: {scenario.metricRef}</span>
                    <span className="text-slate-500">Ref: {scenario.id}</span>
                  </div>
                  <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800 text-xs text-amber-200/90 font-mono">
                    {scenario.context}
                  </div>
                  <h3 className="text-sm font-semibold text-white">{scenario.question}</h3>

                  {/* Options */}
                  <div className="space-y-2 pt-1">
                    {scenario.options.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-3 rounded-xl p-3 border text-xs cursor-pointer transition-colors ${
                          scenario.selectedOptionId === opt.id
                            ? 'border-sky-500 bg-sky-500/10 text-white'
                            : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`scenario_${scenario.id}`}
                          checked={scenario.selectedOptionId === opt.id}
                          onChange={() => handleSelectOptionA(scenario.id, opt.id)}
                          className="mt-0.5 accent-sky-500"
                        />
                        <span className="leading-snug">{opt.label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Confidence Rating Slider (1 to 5) */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Confidence in answer:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Guessing (1)</span>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={scenario.confidence ?? 3}
                        onChange={(e) => handleConfidenceChangeA(scenario.id, Number(e.target.value))}
                        className="w-32 accent-sky-500"
                      />
                      <span className="text-[11px] text-slate-500">Certain (5)</span>
                      <span className="font-bold text-sky-400 ml-1">
                        {scenario.confidence == null ? 'Not rated' : `${scenario.confidence}/5`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('PART_B')}
                className="rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-sky-500 cursor-pointer"
              >
                Continue to Part B: Adjustment Decisions →
              </button>
            </div>
          </div>
        )}

        {/* PART B: ACTIVITY ADJUSTMENT DECISIONS */}
        {activeTab === 'PART_B' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
                Component B: Activity-Adjustment Decision-Making
              </h2>
              <p className="text-xs text-slate-400">
                Uses hypothetical, researcher-developed scenarios. Responses are not observations about a child or clinical recommendations.
              </p>
            </div>

            <div className="space-y-4">
              {evaluation.partB.cases.map((cs, idx) => (
                <div key={cs.id} className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400">Case {idx + 1} (Group: {cs.consistencyGroup})</span>
                    <span className="text-slate-500">ID: {cs.id}</span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    {cs.caseDescription}
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">
                      Selected Clinical/Caregiver Adjustment Decision:
                    </label>
                    <div className="space-y-2">
                      {cs.decisionOptions.map((opt) => (
                        <label
                          key={opt}
                          className={`flex items-start gap-3 rounded-xl p-2.5 border text-xs cursor-pointer transition-colors ${
                            cs.selectedDecision === opt
                              ? 'border-amber-500 bg-amber-500/10 text-white'
                              : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`case_decision_${cs.id}`}
                            checked={cs.selectedDecision === opt}
                            onChange={() => handleDecisionChangeB(cs.id, opt)}
                            className="mt-0.5 accent-amber-500"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Structured Adult Reasoning */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Structured Reasoning / Rationale for this Decision:
                    </label>
                    <textarea
                      rows={2}
                      value={cs.reasoning}
                      onChange={(e) => handleReasoningChangeB(cs.id, e.target.value)}
                      placeholder="Why is this adaptation appropriate based on the measured data?"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/80 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cs.uncertaintyExpressed}
                        onChange={(e) => handleUncertaintyToggleB(cs.id, e.target.checked)}
                        className="h-4 w-4 rounded-md accent-amber-500"
                      />
                      <span className="text-slate-300">Acknowledge uncertainty (data insufficient for firm conclusion)</span>
                    </label>
                    <div>
                      <input
                        type="text"
                        value={cs.additionalInfoRequested}
                        onChange={(e) => handleAdditionalInfoChangeB(cs.id, e.target.value)}
                        placeholder="Additional information requested (e.g. video review, seating check)"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('PART_A')}
                className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                ← Back to Part A
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PART_C')}
                className="rounded-xl bg-amber-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-amber-500 cursor-pointer"
              >
                Continue to Part C: Adult Feedback →
              </button>
            </div>
          </div>
        )}

        {/* PART C: ADULT FEEDBACK */}
        {activeTab === 'PART_C' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
                Component C: Adult Usability, Trust & Qualitative Feedback
              </h2>
              <p className="text-xs text-slate-400">
                Structured Likert questions and qualitative notes on report clarity, trust in metrics, and research limitations.
              </p>
            </div>

            {/* Likert Scale Matrix (1-5) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Evaluation Dimensions (1 = Strongly Disagree, 5 = Strongly Agree)
              </h3>

              <div className="space-y-3">
                {[
                  { key: 'clarity', label: 'Report metrics are easy to understand and avoid misleading jargon' },
                  { key: 'activityAdjustmentUsefulness', label: 'Recorded information would be useful for activity adjustments' },
                  { key: 'trustInMetrics', label: 'I trust the webcam gaze metrics within their stated limitations' },
                  { key: 'childUsability', label: 'The friendly mascot interface was engaging and comfortable for the child' },
                  { key: 'transparencyOfLimitations', label: 'Missing data and tracking uncertainties are clearly explained' },
                ].map((item) => {
                  const ratingKey = item.key as keyof EvaluationPartC['likertRatings'];
                  const val = evaluation.partC.likertRatings[ratingKey];
                  return (
                    <div key={item.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-xs">
                      <span className="text-slate-200 font-medium max-w-md">{item.label}</span>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleLikertChangeC(ratingKey, num)}
                            className={`h-7 w-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              val === num
                                ? 'bg-emerald-500 text-white shadow-xs'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Qualitative Feedback Fields */}
            <div className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Semi-Structured Researcher & Evaluator Notes
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Perceived Strengths of the System:</label>
                  <textarea
                    rows={2}
                    value={evaluation.partC.openResponses.perceivedStrengths}
                    onChange={(e) => handleOpenResponseChangeC('perceivedStrengths', e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Perceived Risks, Ambiguities or Misunderstandings:</label>
                  <textarea
                    rows={2}
                    value={evaluation.partC.openResponses.perceivedRisksOrMisunderstandings}
                    onChange={(e) => handleOpenResponseChangeC('perceivedRisksOrMisunderstandings', e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Researcher Live Observation Notes during Session:</label>
                  <textarea
                    rows={2}
                    value={evaluation.partC.openResponses.researcherNotes}
                    onChange={(e) => handleOpenResponseChangeC('researcherNotes', e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('PART_B')}
                className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                ← Back to Part B
              </button>
              <button
                type="button"
                onClick={handleSaveEvaluation}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 cursor-pointer"
              >
                Submit Evaluation & Review Summary →
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: SUMMARY & EXPORT */}
        {activeTab === 'RESULTS' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    Evaluation Completed & Computed
                  </h2>
                  <p className="text-xs text-slate-300">
                    Evaluation record {evaluation.id} is ready for descriptive analysis and research dataset aggregation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    Download CSV 📊
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    Download JSON 💾
                  </button>
                </div>
              </div>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Part A: Report Understanding
                </span>
                <div className="text-3xl font-extrabold text-sky-400 tabular-nums">
                  {evaluation.partA.totalScore == null
                    ? 'Not scored'
                    : `${evaluation.partA.totalScore} / ${evaluation.partA.answeredCount}`}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {evaluation.partA.answeredCount}/{evaluation.partA.scenarios.length} answered · Avg confidence:{' '}
                  {evaluation.partA.averageConfidence == null ? 'Not rated' : `${evaluation.partA.averageConfidence.toFixed(1)}/5`} ·
                  Calibration gap: {evaluation.partA.calibrationGap == null ? 'Not available' : `${evaluation.partA.calibrationGap}%`}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Part B: Decision Consistency
                </span>
                <div className="text-3xl font-extrabold text-amber-400 tabular-nums">
                  {evaluation.partB.consistencyScore == null ? 'Not scored' : `${evaluation.partB.consistencyScore}%`}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Researcher-developed rubric: same action category = 100%, different category = 50%; this does not score decision quality.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Part C: Mean Likert Score
                </span>
                <div className="text-3xl font-extrabold text-emerald-400 tabular-nums">
                  {Object.values(evaluation.partC.likertRatings).filter((rating) => rating > 0).length > 0
                    ? `${(
                        Object.values(evaluation.partC.likertRatings).filter((rating) => rating > 0).reduce((a, b) => a + b, 0) /
                        Object.values(evaluation.partC.likertRatings).filter((rating) => rating > 0).length
                      ).toFixed(1)} / 5.0`
                    : 'Not rated'}
                </div>
                <p className="text-xs text-slate-400 mt-2">Overall evaluator usability and clarity rating</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Export Record Preview</h3>
              <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-400 border border-slate-800 max-h-64">
                {JSON.stringify(evaluation, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
