export const bloodTypes = [
  "Don't know",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export const chronicConditions = [
  "Don't know",
  "Diabetes",
  "Hypertension",
  "Heart Disease",
  "Asthma",
  "Cancer",
  "Kidney Disease",
  "Liver Disease",
  "Thyroid Disorder",
  "Epilepsy",
  "Multiple Sclerosis",
  "Parkinson's Disease",
  "Arthritis",
  "Osteoporosis",
] as const;

export const allergiesList = [
  "Don't know",
  "Penicillin",
  "Sulfa drugs",
  "Aspirin",
  "Ibuprofen",
  "Latex",
  "Dust",
  "Pollen",
  "Pet dander",
  "Food - Peanuts",
  "Food - Tree nuts",
  "Food - Shellfish",
  "Food - Fish",
  "Food - Eggs",
  "Food - Milk",
  "Food - Wheat",
  "Food - Soy",
] as const;

export const hereditaryDiseases = [
  "Don't know",
  "Diabetes",
  "Hypertension",
  "Heart Disease",
  "Cancer",
  "Kidney Disease",
  "Liver Disease",
  "Thyroid Disorder",
  "Mental Health Disorders",
  "Blood Disorders",
  "Genetic Disorders",
] as const;

export const smokingStatusOptions = [
  { id: "never", label: "Never smoked" },
  { id: "former", label: "Former smoker" },
  { id: "light", label: "Yes - Light smoker" },
  { id: "moderate", label: "Yes - Moderate smoker" },
  { id: "heavy", label: "Yes - Heavy smoker" },
  { id: "dont_know", label: "Don't know" },
] as const;

export const chronicMedications = [
  "Don't know",
  "Diabetes medication (Metformin, Insulin, etc.)",
  "Blood pressure medication",
  "Cholesterol medication (Statins)",
  "Thyroid medication (Levothyroxine)",
  "Heart medication",
  "Asthma inhalers",
  "Anticoagulants (Blood thinners)",
  "Anti-seizure medication",
  "Psychiatric medication",
  "Pain medication (Chronic)",
  "Hormone therapy",
  "Immunosuppressants",
] as const;
