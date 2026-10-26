import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

type Kind = 'accepted' | 'refused' | 'ready' | 'secondCancelled'

interface Props {
  kind?: Kind
  ref?: string
  name?: string
  message?: string
}

const COPY: Record<Kind, { subject: string; title: string; body: string }> = {
  accepted: {
    subject: 'Votre commande est acceptée',
    title: 'Commande acceptée',
    body: 'Bonne nouvelle : nous avons bien reçu et accepté votre commande. Nous la préparons dès maintenant.',
  },
  refused: {
    subject: 'Votre commande a été refusée',
    title: 'Commande refusée',
    body: "Nous sommes désolés : nous ne pouvons pas donner suite à votre commande. Si vous avez déjà payé, vous serez remboursé. N'hésitez pas à nous contacter.",
  },
  ready: {
    subject: 'Votre commande est prête',
    title: 'Commande prête à retirer',
    body: 'Votre commande est prête. Vous pouvez venir la récupérer sur place dès maintenant.',
  },
  secondCancelled: {
    subject: 'Votre 2e paiement a été annulé',
    title: '2e paiement annulé',
    body: "Le 2e paiement de votre commande en 2 fois a été annulé : aucun prélèvement automatique ne sera plus effectué sur votre carte. Pour toute question, contactez-nous.",
  },
}

function OrderUpdate({ kind = 'accepted', ref = 'VCPXXXXX', name, message }: Props) {
  const c = COPY[kind] ?? COPY.accepted
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`${c.title} — ${ref}`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ backgroundColor: '#1b1233', borderRadius: 12, padding: 24, maxWidth: 520 }}>
          <Heading style={{ color: '#f0abfc', fontSize: 20, margin: '0 0 12px' }}>{c.title}</Heading>
          <Text style={{ color: '#f3e8ff', fontSize: 14 }}>{name ? `Bonjour ${name},` : 'Bonjour,'}</Text>
          {message
            ? message.split(/\n+/).map((line, i) => (
                <Text key={i} style={{ color: '#f3e8ff', fontSize: 14, margin: '0 0 10px' }}>{line}</Text>
              ))
            : <Text style={{ color: '#f3e8ff', fontSize: 14 }}>{c.body}</Text>}
          <Text style={{ color: '#c4b5fd', fontSize: 14 }}>Numéro de commande : <strong>{ref}</strong></Text>
          <Text style={{ color: '#a78bfa', fontSize: 12, marginTop: 16 }}>Merci, l'équipe Vcampro</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrderUpdate,
  subject: (data: Record<string, any>) =>
    `${(COPY[data['kind'] as Kind] ?? COPY.accepted).subject} — ${data['ref'] ?? ''}`.trim(),
  displayName: 'Mise à jour de commande (client)',
  previewData: { kind: 'ready', ref: 'VCP12345', name: 'Marie' },
} satisfies TemplateEntry
