import { Body, Container, Head, Heading, Hr, Html, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface OrderNotificationProps {
  ref?: string
  name?: string
  phone?: string
  email?: string
  delivery?: string
  address?: string
  items?: string
  total?: string
  plan?: string
}

function OrderNotification({
  ref = 'VCPXXXXX',
  name = 'Marie Dupont',
  phone = '06 12 34 56 78',
  email = 'cliente@example.com',
  delivery = 'Livraison à domicile',
  address = '12 rue de la Paix, 75002 Paris',
  items = '1 × iPhone SE 2020',
  total = '320,00 €',
  plan = 'En une fois',
}: OrderNotificationProps) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ backgroundColor: '#0f0a1e', fontFamily: 'Arial, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ backgroundColor: '#1b1233', borderRadius: 12, padding: 24, maxWidth: 520 }}>
          <Heading style={{ color: '#f3e8ff', fontSize: 20, margin: '0 0 8px' }}>
            Nouvelle commande {ref}
          </Heading>
          <Text style={{ color: '#c4b5fd', fontSize: 14, margin: '0 0 16px' }}>
            Une nouvelle commande vient d'être passée sur Vcampro.
          </Text>
          <Section>
            <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Client :</strong> {name}</Text>
            <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Téléphone :</strong> {phone}</Text>
            <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>E-mail :</strong> {email}</Text>
            <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Mode :</strong> {delivery}</Text>
            {address ? (
              <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Adresse :</strong> {address}</Text>
            ) : null}
          </Section>
          <Hr style={{ borderColor: '#3b2764', margin: '16px 0' }} />
          <Section>
            <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Articles :</strong> {items}</Text>
            <Text style={{ color: '#f3e8ff', fontSize: 14, margin: '4px 0' }}><strong>Paiement :</strong> {plan}</Text>
            <Text style={{ color: '#f0abfc', fontSize: 18, margin: '8px 0 0' }}><strong>Total : {total}</strong></Text>
          </Section>
          <Hr style={{ borderColor: '#3b2764', margin: '16px 0' }} />
          <Text style={{ color: '#a78bfa', fontSize: 12, margin: 0 }}>
            Retrouvez tous les détails dans Commandes reçues sur le site.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrderNotification,
  subject: (data: Record<string, any>) => `Nouvelle commande ${data.ref ?? ''} — ${data.total ?? ''}`.trim(),
  displayName: 'Nouvelle commande (avis au propriétaire)',
  to: 'vcampro00@gmail.com',
  previewData: {},
} satisfies TemplateEntry
