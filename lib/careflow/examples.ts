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
    when oxygen < 92

    then {
      alert nurse
      priority high
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
    when heart_rate > 120

    then {
      alert nurse
      priority high
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
  title: "Medical equipment / device alert",
  description:
    "Synthetic ventilator, infusion-pump, and battery signals. Not a real device protocol.",
  source: `// ${SYNTHETIC_DISCLAIMER}
workflow device_alert {

  monitor ventilator_pressure
  monitor infusion_rate
  monitor battery_percent

  rule high_airway_pressure {
    when ventilator_pressure > 35

    then {
      alert respiratory_therapist
      priority high
    }
  }

  rule infusion_runaway {
    when infusion_rate > 500

    then {
      alert nurse
      priority critical
      escalate biomed
    }
  }

  rule low_battery {
    when battery_percent <= 10

    then {
      alert nurse
      priority medium
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
