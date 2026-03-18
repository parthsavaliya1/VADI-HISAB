export interface CropItem {
    value: string;
    label: string;
    image?: any;
    emoji?: string;
    subtypes: string[];
  }
  
  export const CROPSWITHIMAGE: CropItem[] = [
    {
      value: "Groundnut",
      label: "મગફળી",
      image: require("@/assets/crops/magafali1.jpeg"),
      subtypes: [
        "BT-32",
        "BT-37",
        "BT-38",
        "BT-39",
        "BT-45",
        "BT-128",
        "જિવિસ",
        "રોહિણી",
        "મિનક્ષી",
        "ગિર્ણાર",
        "રેન્બો",
      ],
    },
    {
      value: "Cotton",
      label: "કપાસ",
      image: require("@/assets/crops/kapas1.png"),
      subtypes: ["2 BT", "ભક્તિ", "ATM", "જાદુ"],
    },
    {
      value: "Chana",
      label: "ચણા",
      image: require("@/assets/crops/chana.png"),
      subtypes: ["દેશી", "3", "કાબુલી", "સફેદ"],
    },
    {
      value: "Jeera",
      label: "જીરું",
      image: require("@/assets/crops/jiru.png"),
      subtypes: ["માંગલમ 4", "માંગલમ 5", "નિસાન 444", "જીરાલી", "કૈલાશ 4"],
    },
    {
      value: "Wheat",
      label: "ઘઉં",
      image: require("@/assets/crops/wheat.png"),
      subtypes: ["452", "496", "લોક 1"],
    },
    {
      value: "Garlic",
      label: "લસણ",
      image: require("@/assets/crops/lasan.png"),
      subtypes: ["દેશી", "MP", "ચાઇનીઝ"],
    },
    {
      value: "Onion",
      label: "ડુંગળી",
      image: require("@/assets/crops/dungali.png"),
      subtypes: [
        "પીળી પત્તી",
        "લાલ",
        "સફેદ",
        "દ્રોણા",
        "કલસ કિંગ",
        "પંચ ગંગા",
      ],
    },
    {
      value: "Dhana",
      label: "ધાણા",
      image: require("@/assets/crops/kothami.png"),
      subtypes: ["2", "4", "JAS 4", "ધાણી"],
    },
    {
      value: "Tal",
      label: "તલ",
      image: require("@/assets/crops/tal.png"),
      subtypes: ["કાળો", "સફેદ"],
    },
    {
      value: "Maize",
      label: "મકાઈ",
      image: require("@/assets/crops/makai.png"),
      subtypes: ["સાદી", "અમેરિકન"],
    },
    {
      value: "Kalonji",
      label: "કલોનજી",
      image: require("@/assets/crops/kalanji.png"),
      subtypes: ["સ્થાનિક"],
    },
    {
      value: "Moong",
      label: "મગ",
      image: require("@/assets/crops/mag.png"),
      subtypes: ["સ્થાનિક"],
    },
    {
      value: "Urad",
      label: "અડદ",
      image: require("@/assets/crops/tal.png"),
      subtypes: ["સ્થાનિક"],
    },
    {
      value: "Moth",
      label: "મઠ",
      image: require("@/assets/crops/soyabean.png"),
      subtypes: ["સ્થાનિક"],
    },
    {
      value: "Vatana",
      label: "વટાણા",
      image: require("@/assets/crops/vatana.png"),
      subtypes: ["લીલા", "સફેદ"],
    },
    {
      value: "Val",
      label: "વાલ",
      image: require("@/assets/crops/val.png"),
      subtypes: ["સ્થાનિક"],
    },
    {
      value: "Soybean",
      label: "સોયાબીન",
      image: require("@/assets/crops/soyabean.png"),
      subtypes: ["સ્થાનિક"],
    },
    {
      value: "Castor",
      label: "એરંડા",
      image: require("@/assets/crops/soyabean.png"),
      subtypes: ["સ્થાનિક"],
    },
    {
      value: "Tuver",
      label: "તુવર",
      image: require("@/assets/crops/soyabean.png"),
      subtypes: ["સ્થાનિક"],
    },
    {
      value: "Methi",
      label: "મેથી",
      image: require("@/assets/crops/methi.png"),
      subtypes: ["સ્થાનિક"],
    },
    {
      value: "Bajra",
      label: "બાજરી",
      image: require("@/assets/crops/soyabean.png"),
      subtypes: ["સ્થાનિક"],
    },
    {
      value: "Marchi",
      label: "મરચી",
      image: require("@/assets/crops/marcha.png"),
      subtypes: ["લાંબી", "દેશી", "તીખી", "કાશ્મીરી"],
    },
  ];