import {
  calculateDowngrade,
  ConductGrade,
  MonthlyConductEvaluation,
  Student,
  ViolationRecord
} from '../../src/types/index.ts';

/**
 * Calculates monthly conduct evaluation for students in a specific class and month_key
 */
export function calculateMonthlyConduct(
  students: Student[],
  violations: ViolationRecord[],
  savedEvaluations: MonthlyConductEvaluation[],
  className: string,
  monthKey: string
): MonthlyConductEvaluation[] {
  // Filter active students of this class
  const classStudents = students.filter(
    (s) => s.className === className && s.isActive
  );

  return classStudents.map((student) => {
    // Find existing saved evaluation (if any approved previously)
    const existing = savedEvaluations.find(
      (e) => e.month_key === monthKey && e.student_id === student.id
    );

    const initialGrade: ConductGrade = existing?.initial_grade || 'TOT';

    // Find all violations for this student in this exact calendar month_key
    // Note: Month must come from occurred_at, not recorded_at
    const studentViolations = violations.filter((v) => {
      return (
        v.student_id === student.id &&
        v.month_key === monthKey &&
        v.verification_status !== 'DA_HUY'
      );
    });

    let vehicleCount = 0;
    let phoneCommitmentCount = 0;
    let phoneReportCount = 0;
    let otherCount = 0;
    let totalDowngradeSteps = 0;
    let pendingDecisionsCount = 0;

    studentViolations.forEach((v) => {
      // Rule: unconfirmed violations are not counted in steps, but counted as pending
      if (v.verification_status === 'CHO_XAC_NHAN') {
        pendingDecisionsCount++;
        return;
      }

      if (v.violation_code === 'VEHICLE_ON_CAMPUS') {
        vehicleCount++;
        totalDowngradeSteps += 1;
      } else if (v.violation_code === 'PHONE_COMMITMENT') {
        phoneCommitmentCount++;
        totalDowngradeSteps += 1;
      } else if (v.violation_code === 'PHONE_REPORT') {
        phoneReportCount++;
        // "Không tự quy đổi thành hạ 1 bậc. Lưu trạng thái 'Chờ xử lý theo quy định'.
        // Nếu quyết định xử lý có hạ bậc, chỉ tính khi người có thẩm quyền xác nhận số bậc cụ thể."
        if (v.decision_status === 'DA_XU_LY' && v.approved_downgrade_steps !== undefined) {
          totalDowngradeSteps += v.approved_downgrade_steps;
        } else {
          pendingDecisionsCount++;
        }
      } else if (v.violation_code === 'OTHER') {
        otherCount++;
        // "Không tự áp dụng mức hạ bậc khi chưa có cấu hình hoặc quyết định."
        if (v.decision_status === 'DA_XU_LY' && v.approved_downgrade_steps !== undefined) {
          totalDowngradeSteps += v.approved_downgrade_steps;
        } else if (v.proposed_downgrade_steps > 0) {
          totalDowngradeSteps += v.proposed_downgrade_steps;
        } else if (v.decision_status === 'CHO_QUYET_DINH') {
          pendingDecisionsCount++;
        }
      }
    });

    const proposedGrade = calculateDowngrade(initialGrade, totalDowngradeSteps);

    return {
      id: `${monthKey}_${student.id}`,
      month_key: monthKey,
      student_id: student.id,
      student_name: student.name,
      class_name: className,
      initial_grade: initialGrade,
      vehicle_count: vehicleCount,
      phone_commitment_count: phoneCommitmentCount,
      phone_report_count: phoneReportCount,
      other_count: otherCount,
      total_downgrade_steps: totalDowngradeSteps,
      pending_decisions_count: pendingDecisionsCount,
      proposed_grade: proposedGrade,
      approved_grade: existing?.approved_grade,
      approved_by: existing?.approved_by,
      approved_at: existing?.approved_at,
      notes: existing?.notes || ''
    };
  });
}
