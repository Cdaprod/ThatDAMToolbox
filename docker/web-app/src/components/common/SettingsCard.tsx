'use client';

// Simple card wrapper for settings sections.
// Example: <SettingsCard title="General">...</SettingsCard>

import { Card, CardContent, CardHeader } from '@mui/material';
import * as React from 'react';

export function SettingsCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardHeader title={title} action={action} />
      <CardContent>{children}</CardContent>
    </Card>
  );
}

