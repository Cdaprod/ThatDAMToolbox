// Tenant settings page aggregating all configuration sections.
// Example: /mytenant/settings

import { GeneralBrandingForm } from '../../../components/settings/GeneralBrandingForm';
import { DomainsForm } from '../../../components/settings/DomainsForm';
import { SsoForm } from '../../../components/settings/SsoForm';
import { StorageForm } from '../../../components/settings/StorageForm';
import { CaptureDefaultsForm } from '../../../components/settings/CaptureDefaultsForm';
import { PermissionsModelForm } from '../../../components/settings/PermissionsModelForm';
import { SettingsAuditLog } from '../../../components/settings/AuditLog';
import { Box, Container, Typography } from '@mui/material';

export default function TenantSettingsPage({ params }: { params: { tenant: string } }) {
  const tenant = params.tenant;
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>General &amp; Branding</Typography>
      <GeneralBrandingForm tenant={tenant} />
      <DomainsForm tenant={tenant} />
      <SsoForm tenant={tenant} />
      <StorageForm tenant={tenant} />
      <CaptureDefaultsForm tenant={tenant} />
      <PermissionsModelForm tenant={tenant} />
      <Box sx={{ mt: 4 }}>
        <SettingsAuditLog tenant={tenant} />
      </Box>
    </Container>
  );
}

