"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  Badge,
  FormField,
  Input,
  Select,
  FormRow,
  EmptyState,
  Alert,
  ProgressBar,
  ListItem,
  PageHeader,
} from "../components";
import { ExerciseInput, type SetData } from "../components/ExerciseInput/ExerciseInput";
import styles from "./sandbox.module.css";

// ── Mock data for ExerciseInput ──
const MOCK_LAST_WEEK: SetData[] = [
  { reps: 10, weight: 185, weightUnit: "lbs", timeSeconds: null, rpe: 7 },
  { reps: 10, weight: 185, weightUnit: "lbs", timeSeconds: null, rpe: 8 },
  { reps: 8, weight: 185, weightUnit: "lbs", timeSeconds: null, rpe: 9 },
];

const MOCK_CARDIO_LAST: SetData[] = [
  { reps: null, weight: null, weightUnit: "lbs", timeSeconds: 1800, rpe: 6 },
];

function ExerciseInputDemo() {
  const [sets, setSets] = useState<SetData[]>([
    { reps: 12, weight: 190, weightUnit: "lbs", timeSeconds: null, rpe: 7 },
    { reps: 10, weight: 190, weightUnit: "lbs", timeSeconds: null, rpe: 8 },
    { reps: 8, weight: 190, weightUnit: "lbs", timeSeconds: null, rpe: 9 },
  ]);
  const [rest, setRest] = useState<number | null>(90);
  const [comment, setComment] = useState("");

  const [cardioSets, setCardioSets] = useState<SetData[]>([
    { reps: null, weight: null, weightUnit: "lbs", timeSeconds: 2100, rpe: 7 },
  ]);
  const [cardioRest, setCardioRest] = useState<number | null>(null);
  const [cardioComment, setCardioComment] = useState("felt strong on hills");

  const [freshSets, setFreshSets] = useState<SetData[]>([
    { reps: null, weight: null, weightUnit: "lbs", timeSeconds: null, rpe: null },
  ]);
  const [freshRest, setFreshRest] = useState<number | null>(60);
  const [freshComment, setFreshComment] = useState("");

  return (
    <div className={styles.stack}>
      <p className={styles.muted}>Strength — went up in weight, more reps on set 1:</p>
      <ExerciseInput
        name="Bench Press"
        equipment="Barbell"
        contextLabel="Flat"
        sets={sets}
        restSeconds={rest}
        lastWeekSets={MOCK_LAST_WEEK}
        comment={comment}
        onSetsChange={setSets}
        onRestChange={setRest}
        onCommentChange={setComment}
      />

      <p className={styles.muted}>Cardio — longer time, higher RPE:</p>
      <ExerciseInput
        name="Tempo Run"
        equipment=""
        contextLabel="Hills"
        sets={cardioSets}
        restSeconds={cardioRest}
        lastWeekSets={MOCK_CARDIO_LAST}
        comment={cardioComment}
        onSetsChange={setCardioSets}
        onRestChange={setCardioRest}
        onCommentChange={setCardioComment}
      />

      <p className={styles.muted}>New exercise — no last week data:</p>
      <ExerciseInput
        name="Face Pulls"
        equipment="Cable"
        sets={freshSets}
        restSeconds={freshRest}
        lastWeekSets={null}
        comment={freshComment}
        onSetsChange={setFreshSets}
        onRestChange={setFreshRest}
        onCommentChange={setFreshComment}
      />
    </div>
  );
}

export default function SandboxPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sections: { id: string; label: string; render: () => React.ReactNode }[] = [
    {
      id: "exercise-input",
      label: "Exercise Input",
      render: () => <ExerciseInputDemo />,
    },
    {
      id: "buttons",
      label: "Buttons",
      render: () => (
        <div className={styles.grid}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="md">Medium</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="primary" fullWidth>Full Width</Button>
        </div>
      ),
    },
    {
      id: "cards",
      label: "Cards",
      render: () => (
        <div className={styles.stack}>
          <Card>
            <CardHeader>Default Header</CardHeader>
            <div className={styles.cardBody}>Card body content</div>
          </Card>
          <Card>
            <CardHeader subtle>Subtle Header</CardHeader>
            <div className={styles.cardBody}>Card with subtle header</div>
          </Card>
        </div>
      ),
    },
    {
      id: "badges",
      label: "Badges",
      render: () => (
        <div className={styles.grid}>
          <Badge variant="equipment">Barbell</Badge>
          <Badge variant="context">Tempo</Badge>
          <Badge variant="blockType">Strength</Badge>
        </div>
      ),
    },
    {
      id: "forms",
      label: "Form Fields",
      render: () => (
        <div className={styles.stack}>
          <FormField label="Regular Input">
            <Input placeholder="Type something..." />
          </FormField>
          <FormField label="Compact Input" compact>
            <Input compact placeholder="Compact..." />
          </FormField>
          <FormField label="Select">
            <Select>
              <option>Option 1</option>
              <option>Option 2</option>
              <option>Option 3</option>
            </Select>
          </FormField>
          <FormRow>
            <FormField label="Inline A">
              <Input placeholder="A" />
            </FormField>
            <FormField label="Inline B">
              <Input placeholder="B" />
            </FormField>
          </FormRow>
          <FormRow wrap>
            <FormField label="Wrap 1">
              <Input placeholder="1" />
            </FormField>
            <FormField label="Wrap 2">
              <Input placeholder="2" />
            </FormField>
            <FormField label="Wrap 3">
              <Input placeholder="3" />
            </FormField>
          </FormRow>
        </div>
      ),
    },
    {
      id: "alerts",
      label: "Alerts",
      render: () => (
        <div className={styles.stack}>
          <Alert variant="success">Success message</Alert>
          <Alert variant="error">Error message</Alert>
          <Alert variant="info">Info message</Alert>
        </div>
      ),
    },
    {
      id: "progress",
      label: "Progress Bars",
      render: () => (
        <div className={styles.stack}>
          <ProgressBar label="Chest Sets" current={7} target={10} unit="sets" />
          <ProgressBar label="Mileage" current={12} target={15} unit="miles" />
          <ProgressBar label="Stretching" current={30} target={30} unit="min" />
          <ProgressBar label="Empty" current={0} target={20} unit="reps" />
        </div>
      ),
    },
    {
      id: "listitems",
      label: "List Items",
      render: () => (
        <Card>
          <ListItem>Default item</ListItem>
          <ListItem clickable onClick={() => {}}>Clickable item</ListItem>
          <ListItem dimmed>Dimmed item</ListItem>
          <ListItem column>
            <span>Column item</span>
            <span className={styles.muted}>Secondary text</span>
          </ListItem>
        </Card>
      ),
    },
    {
      id: "empty",
      label: "Empty State",
      render: () => (
        <EmptyState>
          <p>Nothing here yet.</p>
          <Button variant="primary">Add something</Button>
        </EmptyState>
      ),
    },
    {
      id: "pageheader",
      label: "Page Header",
      render: () => (
        <div className={styles.stack}>
          <PageHeader title="Page Title">
            <Button variant="primary">Action</Button>
          </PageHeader>
          <PageHeader title="No Actions" />
        </div>
      ),
    },
    {
      id: "freehand",
      label: "Freehand",
      render: () => (
        <div className={styles.freehand}>
          <p className={styles.freehandHint}>
            Edit this section in <code>app/tempapp/sandbox/page.tsx</code> to prototype anything.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader title="Component Sandbox" />

      <div className={styles.nav}>
        {sections.map((s) => (
          <button
            key={s.id}
            className={`${styles.navBtn} ${activeSection === s.id ? styles.navBtnActive : ""}`}
            onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection
        ? sections.find((s) => s.id === activeSection)?.render()
        : sections.map((s) => (
            <div key={s.id} className={styles.section}>
              <h2 className={styles.sectionTitle}>{s.label}</h2>
              {s.render()}
            </div>
          ))}
    </div>
  );
}
