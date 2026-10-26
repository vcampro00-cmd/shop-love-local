import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props { ref?: string; name?: string; phone?: string; amount?: string; reason?: string }

function SecondPaymentFailed({ ref = 'VCPXXXXX', name = 'Client', phone = '', amount = '', reason = '' }: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Échec du 2e paiement — ${ref}`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ backgroundColor: '#1b1233', borderRadius: 12, padding: 24, maxWidth: 520 }}>
          <Heading style={{ color: '#f87171', fontSize: 20, margin: '0 0 12px' }}>Échec du 2e paiement</Heading>
          <Text style={{ color: '#f3e8ff', fontSize: 14 }}>Le prélèvement automatique du 2e paiement a été refusé.</Text>
          <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Commande :</strong> {ref}</Text>
          <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Client :</strong> {name}</Text>
          {phone ? <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Téléphone :</strong> {phone}</Text> : null}
          {amount ? <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Montant :</strong> {amount}</Text> : null}
          {reason ? <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Motif :</strong> {reason}</Text> : null}
          <Text style={{ color: '#a78bfa', fontSize: 12, marginTop: 16 }}>Voir la Caisse sur vcampro.shop pour annuler le 2e paiement ou créer un rappel.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SecondPaymentFailed,
  subject: (d: Record<string, any>) => `Échec du 2e paiement — ${d['ref'] ?? ''}`.trim(),
  displayName: 'Échec du 2e paiement (propriétaire)',
  previewData: { ref: 'VCP12345', name: 'Marie', phone: '+33 6 12 34 56 78', amount: '150,00 €', reason: 'Carte refusée' },
  to: 'vcampro00@gmail.com',
} satisfies TemplateEntry
