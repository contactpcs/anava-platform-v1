import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface QuestionnaireState {
  sessionId: string | null;
  scaleOrder: string[];
  currentScaleIndex: number;
  currentQuestionIndex: number;
  responses: Record<string, Record<string, number | string>>;
  isVoiceMode: boolean;
}

const initialState: QuestionnaireState = {
  sessionId: null,
  scaleOrder: [],
  currentScaleIndex: 0,
  currentQuestionIndex: 0,
  responses: {},
  isVoiceMode: false,
};

const questionnaireSlice = createSlice({
  name: "questionnaire",
  initialState,
  reducers: {
    initQuestionnaire: (state, action: PayloadAction<{ sessionId: string; scaleOrder: string[]; existingResponses?: Record<string, Record<string, number | string>> }>) => {
      state.sessionId = action.payload.sessionId;
      state.scaleOrder = action.payload.scaleOrder;
      state.currentScaleIndex = 0;
      state.currentQuestionIndex = 0;
      state.responses = action.payload.existingResponses || {};
    },
    setAnswer: (state, action: PayloadAction<{ scaleId: string; questionIndex: number; value: number | string }>) => {
      const { scaleId, questionIndex, value } = action.payload;
      if (!state.responses[scaleId]) state.responses[scaleId] = {};
      state.responses[scaleId][String(questionIndex)] = value;
    },
    nextQuestion: (state, action: PayloadAction<{ totalQuestions: number }>) => {
      if (state.currentQuestionIndex < action.payload.totalQuestions - 1) {
        state.currentQuestionIndex += 1;
      }
    },
    prevQuestion: (state) => {
      if (state.currentQuestionIndex > 0) {
        state.currentQuestionIndex -= 1;
      }
    },
    nextScale: (state) => {
      if (state.currentScaleIndex < state.scaleOrder.length - 1) {
        state.currentScaleIndex += 1;
        state.currentQuestionIndex = 0;
      }
    },
    prevScale: (state) => {
      if (state.currentScaleIndex > 0) {
        state.currentScaleIndex -= 1;
        state.currentQuestionIndex = 0;
      }
    },
    goToScale: (state, action: PayloadAction<number>) => {
      state.currentScaleIndex = action.payload;
      state.currentQuestionIndex = 0;
    },
    clearScaleResponses: (state, action: PayloadAction<string>) => {
      delete state.responses[action.payload];
    },
    toggleVoiceMode: (state) => {
      state.isVoiceMode = !state.isVoiceMode;
    },
    resetQuestionnaire: () => initialState,
  },
});

export const {
  initQuestionnaire, setAnswer,
  nextQuestion, prevQuestion,
  nextScale, prevScale, goToScale,
  clearScaleResponses,
  toggleVoiceMode, resetQuestionnaire,
} = questionnaireSlice.actions;

export default questionnaireSlice.reducer;
