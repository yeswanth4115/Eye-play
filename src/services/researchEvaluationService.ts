/**
 * Research Evaluation Service for EyePlay
 * Implements the 3-part adult evaluation workflow:
 * Part A: Report Understanding & Confidence Calibration
 * Part B: Activity Adjustment Decision-Making & Consistency
 * Part C: Adult Feedback, Usability, and Researcher Observation Notes
 */

import { AdultEvaluationRecord, EvaluationPartA, EvaluationPartB, EvaluationPartC } from '../types';

const RESEARCH_EVAL_STORAGE_KEY = 'eyeplay_research_evaluations_v2';

export function createDefaultEvaluation(
  participantPseudonym = '',
  sessionId?: string
): AdultEvaluationRecord {
  const partA: EvaluationPartA = {
    scenarios: [
      {
        id: 'q1_unavailable_measure',
        question: 'A report says a measure was not recorded. What can you conclude?',
        context: 'This prototype leaves unsupported measurements unavailable.',
        metricRef: 'Unavailable data',
        options: [
          {
            id: 'opt_a',
            label: 'The measure is unavailable; no conclusion about the participant can be drawn from it',
            isCorrect: true,
          },
          {
            id: 'opt_b',
            label: 'The participant did not look at the screen',
            isCorrect: false,
          },
          {
            id: 'opt_c',
            label: 'The participant failed the activity',
            isCorrect: false,
          },
          {
            id: 'opt_d',
            label: 'The measure can be inferred from other unrelated fields',
            isCorrect: false,
          },
        ],
        selectedOptionId: null,
        confidence: null,
        explanation: 'An unavailable measure is missing data, not evidence of a participant behavior or outcome.',
      },
      {
        id: 'q2_missing_data',
        question: 'Some camera frames were not marked as valid. What is the appropriate interpretation?',
        context: 'A portion of the processed frames did not produce a valid gaze estimate.',
        metricRef: 'Tracking completeness',
        options: [
          {
            id: 'opt_a',
            label: 'The participant was not attending',
            isCorrect: false,
          },
          {
            id: 'opt_b',
            label: 'Disclose the gap without assuming why it occurred or interpreting it as inattention',
            isCorrect: true,
          },
          {
            id: 'opt_c',
            label: 'It can be ignored because missing gaze does not affect interpretation',
            isCorrect: false,
          },
        ],
        selectedOptionId: null,
        confidence: null,
        explanation: 'The app records validity but does not reliably identify every cause of missing samples.',
      },
      {
        id: 'q3_touch_separation',
        question: 'A child completed a task using touch mode. What kind of interaction data does that provide?',
        context: 'The session record identifies whether the activity used gaze mode or touch mode.',
        metricRef: 'Interaction mode',
        options: [
          {
            id: 'opt_a',
            label: 'Direct touch interaction; it is not a measurement of eye gaze',
            isCorrect: true,
          },
          {
            id: 'opt_b',
            label: 'A gaze estimate equivalent to a camera-tracked session',
            isCorrect: false,
          },
          {
            id: 'opt_c',
            label: 'Evidence of attention or comprehension',
            isCorrect: false,
          },
        ],
        selectedOptionId: null,
        confidence: null,
        explanation: 'Touch sessions are kept separate from gaze measurements and must not be interpreted as equivalent.',
      },
      {
        id: 'q4_calibration',
        question: 'What does a successful calibration check establish?',
        context: 'Calibration compares estimated gaze positions with target positions for that session.',
        metricRef: 'Calibration status',
        options: [
          {
            id: 'opt_a',
            label: 'Only that the session passed its implemented calibration check; it does not establish clinical accuracy',
            isCorrect: true,
          },
          {
            id: 'opt_b',
            label: 'That every gaze estimate is accurate for every participant and device',
            isCorrect: false,
          },
          {
            id: 'opt_c',
            label: 'That the participant has a particular clinical or developmental profile',
            isCorrect: false,
          },
        ],
        selectedOptionId: null,
        confidence: null,
        explanation: 'Calibration is an estimate-quality check, not independent validation of the gaze model or a clinical assessment.',
      },
      {
        id: 'q5_attention_interpretation',
        question: 'Can this prototype determine a child’s attention or comprehension from gaze samples?',
        context: 'The app records estimates and task interactions but does not have validated attention measures.',
        metricRef: 'Interpretation limits',
        options: [
          {
            id: 'opt_a',
            label: 'No; gaze estimates and task responses do not establish attention or comprehension',
            isCorrect: true,
          },
          {
            id: 'opt_b',
            label: 'Yes; gaze at a target proves that the child understood it',
            isCorrect: false,
          },
        ],
        selectedOptionId: null,
        confidence: null,
        explanation: 'This is a research and interaction prototype, not a validated attention or comprehension assessment.',
      },
    ],
    answeredCount: 0,
    totalScore: null,
    averageConfidence: null,
    calibrationGap: null,
  };

  const partB: EvaluationPartB = {
    cases: [
      {
        id: 'case_1_motion_difficulty',
        caseDescription:
          'Hypothetical scenario: a child says a moving target is too fast and repeatedly asks for a slower activity.',
        observedMetricSummary: 'No gaze or clinical score is supplied; use the child’s stated preference and available context.',
        decisionOptions: [
          'Reduce target motion speed and offer a larger target',
          'Offer a clearly labelled touch alternative',
          'Continue unchanged despite the child’s request',
          'Stop or pause and ask what the child would prefer',
        ],
        selectedDecision: null,
        reasoning: '',
        uncertaintyExpressed: false,
        additionalInfoRequested: '',
        rubricScore: null,
        consistencyGroup: 'SPEED_DIFFICULTY',
      },
      {
        id: 'case_2_target_difficulty',
        caseDescription:
          'Hypothetical comparable scenario: a child says the targets are difficult to follow and asks for more time.',
        observedMetricSummary: 'No gaze or clinical score is supplied; respond to the request without inferring attention.',
        decisionOptions: [
          'Reduce target speed and allow more time',
          'Offer a clearly labelled touch alternative',
          'Increase difficulty to challenge the child',
          'Pause or end the activity if preferred',
        ],
        selectedDecision: null,
        reasoning: '',
        uncertaintyExpressed: false,
        additionalInfoRequested: '',
        rubricScore: null,
        consistencyGroup: 'SPEED_DIFFICULTY',
      },
      {
        id: 'case_3_tracking_unavailable',
        caseDescription:
          'Hypothetical scenario: the camera view is interrupted and gaze samples become unavailable.',
        observedMetricSummary: 'The cause is not established. The app has not measured the participant’s attention.',
        decisionOptions: [
          'Pause, explain the tracking issue, and check camera setup before continuing',
          'Treat missing samples as evidence of inattention',
          'Continue and report the unavailable samples honestly',
          'Offer touch mode as a separate interaction option',
        ],
        selectedDecision: null,
        reasoning: '',
        uncertaintyExpressed: false,
        additionalInfoRequested: '',
        rubricScore: null,
        consistencyGroup: 'ENVIRONMENT_ERROR',
      },
    ],
    consistencyScore: null,
    overallRubricTotal: null,
  };

  const partC: EvaluationPartC = {
    likertRatings: {
      clarity: 0,
      activityAdjustmentUsefulness: 0,
      trustInMetrics: 0,
      childUsability: 0,
      transparencyOfLimitations: 0,
    },
    openResponses: {
      perceivedStrengths: '',
      perceivedRisksOrMisunderstandings: '',
      suggestedImprovements: '',
      researcherNotes: '',
    },
    submittedAt: '',
  };

  return {
    id: `EVAL_${Date.now()}`,
    sessionId,
    participantPseudonym,
    evaluatorRole: 'Researcher',
    timestamp: new Date().toISOString(),
    partA,
    partB,
    partC,
  };
}

class ResearchEvaluationService {
  public getAllEvaluations(): AdultEvaluationRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(RESEARCH_EVAL_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public computeScores(record: AdultEvaluationRecord) {
    let correctCount = 0;
    let answeredCount = 0;
    const confidences: number[] = [];
    record.partA.scenarios.forEach((s) => {
      if (s.selectedOptionId == null) {
        s.isCorrect = null;
        return;
      }

      const correctOpt = s.options.find((o) => o.isCorrect);
      s.isCorrect = s.selectedOptionId === correctOpt?.id;
      answeredCount++;
      if (s.isCorrect) correctCount++;
      if (s.confidence != null) confidences.push(s.confidence);
    });

    record.partA.answeredCount = answeredCount;
    record.partA.totalScore = answeredCount > 0 ? correctCount : null;
    record.partA.averageConfidence =
      confidences.length > 0
        ? confidences.reduce((total, confidence) => total + confidence, 0) / confidences.length
        : null;
    record.partA.calibrationGap =
      answeredCount === record.partA.scenarios.length &&
      confidences.length === record.partA.scenarios.length &&
      record.partA.averageConfidence != null
        ? Math.round((correctCount / answeredCount) * 100 - (record.partA.averageConfidence / 5) * 100)
        : null;

    const speedCases = record.partB.cases.filter((c) => c.consistencyGroup === 'SPEED_DIFFICULTY');
    const firstDecision = speedCases[0]?.selectedDecision;
    const secondDecision = speedCases[1]?.selectedDecision;
    if (!firstDecision || !secondDecision) {
      record.partB.consistencyScore = null;
      return;
    }

    const category = (decision: string) => {
      const normalized = decision.toLowerCase();
      if (normalized.includes('reduce')) return 'adjust';
      if (normalized.includes('touch')) return 'touch';
      if (normalized.includes('pause') || normalized.includes('stop')) return 'pause';
      return 'continue';
    };
    record.partB.consistencyScore = category(firstDecision) === category(secondDecision) ? 100 : 50;
  }

  public saveEvaluation(record: AdultEvaluationRecord): boolean {
    record.partC.submittedAt = new Date().toISOString();
    this.computeScores(record);
    if (typeof window === 'undefined') return true;
    try {

      const all = this.getAllEvaluations();
      const updated = [record, ...all.filter((r) => r.id !== record.id)].slice(0, 50);
      localStorage.setItem(RESEARCH_EVAL_STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch (e) {
      console.warn('[ResearchEvaluationService] Error saving record:', e);
      return false;
    }
  }

  public exportEvaluationsAsCsv(records: AdultEvaluationRecord[]): string {
    const headers = [
      'Evaluation_ID',
      'Session_ID',
      'Participant_Pseudonym',
      'Evaluator_Role',
      'Timestamp',
      'PartA_Correct_Answered',
      'PartA_Answered_Count',
      'PartA_Avg_Confidence_1_to_5',
      'PartA_Calibration_Gap',
      'PartB_Consistency_Score',
      'PartC_Clarity_Rating',
      'PartC_Activity_Adjustment_Usefulness',
      'PartC_Trust_In_Metrics',
      'PartC_Child_Usability',
      'PartC_Transparency_Limitations',
      'PartC_Perceived_Strengths',
      'PartC_Perceived_Risks',
      'PartC_Suggested_Improvements',
      'PartC_Researcher_Notes',
    ];

    const rows = records.map((r) => [
      `"${r.id}"`,
      `"${r.sessionId || ''}"`,
      `"${r.participantPseudonym}"`,
      `"${r.evaluatorRole}"`,
      `"${r.timestamp}"`,
      r.partA.totalScore ?? '',
      r.partA.answeredCount,
      r.partA.averageConfidence?.toFixed(2) ?? '',
      r.partA.calibrationGap ?? '',
      r.partB.consistencyScore ?? '',
      r.partC.likertRatings.clarity || '',
      r.partC.likertRatings.activityAdjustmentUsefulness || '',
      r.partC.likertRatings.trustInMetrics || '',
      r.partC.likertRatings.childUsability || '',
      r.partC.likertRatings.transparencyOfLimitations || '',
      `"${(r.partC.openResponses.perceivedStrengths || '').replace(/"/g, '""')}"`,
      `"${(r.partC.openResponses.perceivedRisksOrMisunderstandings || '').replace(/"/g, '""')}"`,
      `"${(r.partC.openResponses.suggestedImprovements || '').replace(/"/g, '""')}"`,
      `"${(r.partC.openResponses.researcherNotes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  public exportEvaluationsAsJson(records: AdultEvaluationRecord[]): string {
    return JSON.stringify(records, null, 2);
  }
}

export const researchEvaluationService = new ResearchEvaluationService();
