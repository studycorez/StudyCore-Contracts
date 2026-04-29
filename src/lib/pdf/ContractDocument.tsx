import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";
import { buildContractClauses } from "@/lib/contract-text";
import { formatDate } from "@/lib/format";
import type { Contract } from "@/lib/types";

const NAVY = "#1A3C6B";
const ORANGE = "#F97316";
const SLATE = "#475569";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 56,
    fontSize: 10.5,
    lineHeight: 1.5,
    color: "#0f172a",
    fontFamily: "Helvetica",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 10,
    marginBottom: 18,
  },
  brand: {
    color: NAVY,
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "Helvetica-Bold",
  },
  subtitle: {
    color: SLATE,
    fontSize: 11,
    marginTop: 2,
  },
  meta: {
    fontSize: 9,
    color: SLATE,
    marginTop: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginTop: 4,
  },
  clause: {
    marginBottom: 12,
  },
  heading: {
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 6,
  },
  para: {
    marginBottom: 6,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 10,
  },
  bulletText: {
    flex: 1,
  },
  signatureBlock: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  sigRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  sigCol: {
    width: "48%",
  },
  sigLabel: {
    fontSize: 9,
    color: SLATE,
    marginBottom: 4,
  },
  sigImage: {
    height: 50,
    objectFit: "contain",
    marginBottom: 4,
  },
  studyCoreSignature: {
    fontSize: 18,
    color: NAVY,
    fontFamily: "Helvetica-Oblique",
    marginBottom: 4,
  },
  sigName: {
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "Helvetica-Bold",
  },
  sigDate: {
    fontSize: 9,
    color: SLATE,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    textAlign: "center",
    fontSize: 8,
    color: SLATE,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
  },
  pageNumber: {
    position: "absolute",
    bottom: 10,
    right: 24,
    fontSize: 8,
    color: SLATE,
  },
  accent: {
    color: ORANGE,
  },
});

export default function ContractDocument({
  contract,
  signatureDataUrl,
  signedAt,
}: {
  contract: Contract;
  signatureDataUrl?: string | null;
  signedAt?: string | null;
}) {
  const clauses = buildContractClauses(contract);
  const signedDateLabel = signedAt ? formatDate(signedAt) : formatDate(new Date().toISOString());

  return (
    <Document
      title={`StudyCore SAT Agreement – ${contract.student_name}`}
      author="StudyCore LLC"
    >
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>
            STUDYCORE <Text style={styles.accent}>LLC</Text>
          </Text>
          <Text style={styles.subtitle}>SAT Tutoring Services Agreement</Text>
          <Text style={styles.meta}>studycore.net · San Ramon, CA</Text>
        </View>

        {clauses.map((clause, idx) => (
          <View key={idx} style={styles.clause} wrap={false}>
            <Text style={styles.heading}>
              {idx + 1}. {clause.title}
            </Text>
            {clause.paragraphs.map((p, pi) => (
              <Text key={pi} style={styles.para}>
                {p}
              </Text>
            ))}
            {clause.bullets?.map((b, bi) => (
              <View key={bi} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.signatureBlock} wrap={false}>
          <Text style={styles.heading}>{clauses.length + 1}. SIGNATURES</Text>
          <View style={styles.sigRow}>
            <View style={styles.sigCol}>
              <Text style={styles.sigLabel}>Client (Parent / Guardian)</Text>
              {signatureDataUrl ? (
                <Image src={signatureDataUrl} style={styles.sigImage} />
              ) : (
                <View
                  style={{
                    height: 50,
                    borderBottomWidth: 1,
                    borderBottomColor: "#94a3b8",
                    marginBottom: 4,
                  }}
                />
              )}
              <Text style={styles.sigName}>{contract.parent_name}</Text>
              <Text style={styles.sigDate}>Date: {signedDateLabel}</Text>
            </View>
            <View style={styles.sigCol}>
              <Text style={styles.sigLabel}>StudyCore LLC (Authorized Representative)</Text>
              <Text style={styles.studyCoreSignature}>StudyCore LLC</Text>
              <Text style={styles.sigName}>Authorized Representative</Text>
              <Text style={styles.sigDate}>Date: {signedDateLabel}</Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.footer}
          render={() =>
            "StudyCore LLC · support@studycore.net · studycore.net · San Ramon, CA"
          }
          fixed
        />
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
