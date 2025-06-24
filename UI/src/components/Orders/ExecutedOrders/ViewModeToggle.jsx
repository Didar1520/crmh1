/* File: ViewModeToggle.jsx */
import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

export default function ViewModeToggle({ viewMode, setViewMode }) {
  return (
    <ButtonGroup className="mb-3">
      <Button
        variant={viewMode === "all" ? "primary" : "outline-primary"}
        onClick={() => setViewMode("all")}
      >
        Все
      </Button>
      <Button
        variant={viewMode === "day" ? "primary" : "outline-primary"}
        onClick={() => setViewMode("day")}
      >
        По дням
      </Button>
      <Button
        variant={viewMode === "week" ? "primary" : "outline-primary"}
        onClick={() => setViewMode("week")}
      >
        По неделям
      </Button>
      <Button
        variant={viewMode === "month" ? "primary" : "outline-primary"}
        onClick={() => setViewMode("month")}
      >
        По месяцам
      </Button>
    </ButtonGroup>
  );
}
