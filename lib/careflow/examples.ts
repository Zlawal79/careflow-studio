import type { PatientState } from "./types";

/**
 * Synthetic CareFlow demonstration programs.
 *
 * These thresholds and escalation paths are NOT clinical guidance. They exist
 * only to exercise the language for a programming-language hackathon.
 */
export const SYNTHETIC_DISCLAIMER =
  "Synthetic demonstration only. Not clinical advice and not medically authoritative.";

export const DEMO_PATIENT: PatientState = {
  oxygen: 87,
  heart_rate: 82,
  blood_pressure: 120,
  temperature: 37,
  potassium: 6.4,
  lactate: 4.2,
  ventilator_pressure: 38,
  infusion_rate: 999,
  battery_percent: 8,
};

export interface ExampleProgram {
  id: string;
  title: string;
  description: string;
  source: string;
}

export const respiratoryMonitoring: ExampleProgram = {
  id: "respiratory_monitor",
  title: "Respiratory monitoring",
  description:
    "Synthetic SpO2-style thresholds that alert nursing and escalate hypoxia. Demo only.",
  source: `// ${SYNTHETIC_DISCLAIMER}
workflow respiratory_monitor {

  monitor oxygen
  monitor heart_rate

  rule low_oxygen {
    when oxygen < 92 for 30 seconds

    then {
      alert nurse
      priority high
      require acknowledgment within 2 minutes
      otherwise escalate physician
    }
  }

  rule severe_hypoxia {
    when oxygen < 88

    then {
      alert physician
      priority critical
      escalate rapid_response
    }
  }
}
`,
};

export const cardiacDeterioration: ExampleProgram = {
  id: "cardiac_deterioration",
  title: "Cardiac deterioration",
  description:
    "Synthetic heart-rate and blood-pressure bands for a demo deterioration path.",
  source: `// ${SYNTHETIC_DISCLAIMER}
workflow cardiac_deterioration {

  monitor heart_rate
  monitor blood_pressure

  rule tachycardia {
    when heart_rate > 120 for 5 minutes

    then {
      alert nurse
      priority high
      require acknowledgement within 10 minutes
      otherwise escalate physician
    }
  }

  rule hypotension {
    when blood_pressure < 90

    then {
      alert physician
      priority critical
      escalate rapid_response
    }
  }

  rule extreme_tachycardia {
    when heart_rate > 150

    then {
      alert physician
      priority critical
      escalate code_team
    }
  }
}
`,
};

export const criticalLabEscalation: ExampleProgram = {
  id: "critical_lab_escalation",
  title: "Critical lab escalation",
  description:
    "Synthetic laboratory values (potassium, lactate) used only to demo the DSL.",
  source: `// ${SYNTHETIC_DISCLAIMER}
workflow critical_lab_escalation {

  monitor potassium
  monitor lactate

  rule hyperkalemia_alert {
    when potassium > 6.0

    then {
      alert nurse
      priority high
      require acknowledgement within 5 minutes
      otherwise escalate physician
    }
  }

  rule critical_potassium {
    when potassium >= 6.5

    then {
      alert physician
      priority critical
      escalate lab_critical_call
    }
  }

  rule elevated_lactate {
    when lactate > 4.0

    then {
      alert physician
      priority high
      escalate sepsis_review
    }
  }
}
`,
};

export const deviceAlert: ExampleProgram = {
  id: "device_alert",
  title: "ER Ventilator Connectivity Loss",
  description:
    "Synthetic gateway anomaly routed from Clinical Engineering to Hospital Security Operations. No device control.",
  source: `// ${SYNTHETIC_DISCLAIMER}
workflow device_alert {

  monitor connectivity_status

  rule ventilator_connectivity_lost {
    when connectivity_status == 0

    then {
      alert clinical_engineering
      priority high
      require acknowledgment within 2 minutes
      otherwise escalate hospital_security_operations
    }
  }
}
`,
};

export const EXAMPLE_PROGRAMS: ExampleProgram[] = [
  respiratoryMonitoring,
  cardiacDeterioration,
  criticalLabEscalation,
  deviceAlert,
];
