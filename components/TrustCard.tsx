import { View, Text, StyleSheet } from "react-native";

export default function TrustCard() {
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>🛡️</Text>
      </View>
      <Text style={styles.title}>Your safety. Our priority.</Text>
      <Text style={styles.desc}>
        We only use your information to connect you with responders.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(59,130,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  desc: {
    color: "#4b6a8a",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});
