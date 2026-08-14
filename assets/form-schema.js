window.FORM_SCHEMA = [
  {
    id: "email",
    sort_order: 1,
    label: "Email",
    description: "",
    field_type: "email",
    required: true,
    options: [],
    raw_data: { autocomplete: "email", placeholder: "you@example.com" }
  },
  {
    id: "whatsapp",
    sort_order: 2,
    label: "Your Whatsapp Number",
    description: "we will use this to add to Whatsapp Group",
    field_type: "tel",
    required: false,
    options: [],
    raw_data: { autocomplete: "tel", placeholder: "+49 … / +91 …" }
  },
  {
    id: "name",
    sort_order: 3,
    label: "Your Name",
    description: "",
    field_type: "text",
    required: true,
    options: [],
    raw_data: { autocomplete: "name", placeholder: "What should we call you?" }
  },
  {
    id: "city_country",
    sort_order: 4,
    label: "Current City / Country",
    description: "we would use this to decide venue of physical meet up.",
    field_type: "text",
    required: false,
    options: [],
    raw_data: { placeholder: "e.g. Berlin, Germany" }
  },
  {
    id: "who_am_i",
    sort_order: 5,
    label: "Who am I",
    description: "Few words about yourself",
    field_type: "paragraph",
    required: true,
    options: [],
    raw_data: { placeholder: "Tell the community a little about you…" }
  },
  {
    id: "obsessed_building",
    sort_order: 6,
    label: "What I'm obsessed with (currently) / building",
    description: "Mention anything you are passionate about",
    field_type: "paragraph",
    required: true,
    options: [],
    raw_data: { placeholder: "What has your attention right now?" }
  },
  {
    id: "help_with",
    sort_order: 7,
    label: "One thing I can help with:",
    description: "Tell people what you are good at",
    field_type: "paragraph",
    required: true,
    options: [],
    raw_data: { placeholder: "Your superpower, skill, experience…" }
  },
  {
    id: "looking_for",
    sort_order: 8,
    label: "One thing I'm looking for",
    description: "How you intend to benefit from this Community?",
    field_type: "paragraph",
    required: true,
    options: [],
    raw_data: { placeholder: "Co-founder? Feedback? Network? Inspiration?" }
  },
  {
    id: "involvement",
    sort_order: 9,
    label: "Which statement best describes your current involvement?",
    description: "",
    field_type: "multiple_choice",
    required: false,
    options: [
      "I am actively building a startup/product now",
      "I have a clear idea and am looking for collaborators/co-founders.",
      "I am actively looking for an idea/problem to solve, and join others",
      "I want to learn, network, and offer feedback",
      "I want to join and get inspired."
    ],
    raw_data: {}
  },
  {
    id: "primary_skills",
    sort_order: 10,
    label: "What is your primary domain/skill set? (Select all that apply)",
    description: "",
    field_type: "checkboxes",
    required: false,
    options: [
      "Engineering/Coding",
      "Product Management/Strategy",
      "Marketing/Growth",
      "Sales/BizDev",
      "Design/UX",
      "Other"
    ],
    raw_data: { allow_other: true, other_label: "Other" }
  },
  {
    id: "startup_before",
    sort_order: 11,
    label: "Have you been involved in a startup/project before?",
    description: "",
    field_type: "multiple_choice",
    required: false,
    options: ["Yes", "No"],
    raw_data: {}
  },
  {
    id: "startup_details",
    sort_order: 12,
    label: "If yes, please provide a Link to your Startup/project or describe it.",
    description: "",
    field_type: "paragraph",
    required: false,
    options: [],
    raw_data: { placeholder: "Paste a link or describe the project…" }
  },
  {
    id: "remarks",
    sort_order: 13,
    label: "Any Remarks, additional information",
    description: "",
    field_type: "paragraph",
    required: false,
    options: [],
    raw_data: { placeholder: "Anything else you'd like us to know?" }
  },
  {
    id: "consent",
    sort_order: 14,
    label: "I consent to the processing of my personal data for the purposes of community management and internal networking.",
    description: "",
    field_type: "consent",
    required: true,
    options: ["Yes, I consent"],
    raw_data: {}
  }
];
