import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  // Using placeholder since I do not have a real config
  // In a real scenario, this would be populated from environment variables
  apiKey: "mock-api-key",
  authDomain: "mock-project.firebaseapp.com",
  databaseURL: "https://mock-project.firebaseio.com",
  projectId: "mock-project",
  storageBucket: "mock-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
