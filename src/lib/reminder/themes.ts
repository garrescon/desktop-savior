// a theme is an authored list of references so nothing here touches the model
export type ReminderTheme =
    | "love"
    | "strength"
    | "peace"
    | "mercy"
    | "faithfulness"
    | "presence"
    | "provision"
    | "comfort"
    | "forgiveness"
    | "joy";

export interface ReminderDef {
    label: string;
    refs: string[];
}

export const REMINDERS: Record<ReminderTheme, ReminderDef> = {
    love: {
        label: "Love",
        refs: [
            "JHN.3.16", "ROM.5.8", "ZEP.3.17", "1JN.4.9",
            "1JN.4.10", "1JN.4.19", "ROM.8.38", "ROM.8.39",
            "JER.31.3", "EPH.2.4", "JHN.15.13", "PSA.136.26",
        ],
    },
    strength: {
        label: "Strength",
        refs: [
            "ISA.40.31", "PHP.4.13", "PSA.46.1", "2CO.12.9",
            "ISA.41.10", "PSA.28.7", "NEH.8.10", "EPH.6.10",
            "PSA.18.2", "HAB.3.19", "PSA.73.26", "1CH.16.11",
        ],
    },
    peace: {
        label: "Peace",
        refs: [
            "JHN.14.27", "PHP.4.7", "ISA.26.3", "PSA.29.11",
            "JHN.16.33", "COL.3.15", "ROM.5.1", "ROM.15.13",
            "2TH.3.16", "NUM.6.26", "PSA.4.8", "ISA.9.6",
        ],
    },
    mercy: {
        label: "Mercy",
        refs: [
            "LAM.3.22", "LAM.3.23", "PSA.103.8", "PSA.103.12",
            "TIT.3.5", "HEB.4.16", "MIC.7.18", "PSA.51.1",
            "LUK.6.36", "1PE.1.3", "PSA.86.5", "EPH.2.7",
        ],
    },
    faithfulness: {
        label: "Faithfulness",
        refs: [
            "DEU.7.9", "1CO.10.13", "2TI.2.13", "HEB.10.23",
            "PSA.36.5", "PSA.89.1", "1TH.5.24", "NUM.23.19",
            "PSA.119.90", "2TH.3.3", "PSA.100.5", "1CO.1.9",
        ],
    },
    presence: {
        label: "Presence",
        refs: [
            "MAT.28.20", "PSA.139.7", "PSA.139.8", "DEU.31.6",
            "DEU.31.8", "JOS.1.9", "ISA.43.2", "PSA.23.4",
            "PSA.46.10", "HEB.13.5", "MAT.18.20", "PSA.16.11",
        ],
    },
    provision: {
        label: "Provision",
        refs: [
            "PHP.4.19", "MAT.6.26", "MAT.6.33", "PSA.23.1",
            "PSA.34.10", "PSA.37.25", "MAT.7.11", "2CO.9.8",
            "PSA.84.11", "JAS.1.17", "1PE.5.7", "PSA.145.16",
        ],
    },
    comfort: {
        label: "Comfort",
        refs: [
            "PSA.34.18", "MAT.11.28", "2CO.1.3", "2CO.1.4",
            "REV.21.4", "PSA.147.3", "JHN.14.1", "PSA.55.22",
            "ISA.66.13", "MAT.5.4", "PSA.94.19", "ISA.49.13",
        ],
    },
    forgiveness: {
        label: "Forgiveness",
        refs: [
            "1JN.1.9", "ISA.1.18", "ISA.43.25", "MIC.7.19",
            "EPH.1.7", "COL.1.14", "ACT.3.19", "ROM.8.1",
            "HEB.8.12", "PSA.32.1", "LUK.23.34", "PSA.130.4",
        ],
    },
    joy: {
        label: "Joy",
        refs: [
            "JHN.15.11", "PSA.30.5", "GAL.5.22", "PSA.126.3",
            "HAB.3.18", "1PE.1.8", "PSA.118.24", "JHN.16.22",
            "PHP.4.4", "ROM.15.13", "PSA.28.7", "ISA.55.12",
        ],
    },
};
