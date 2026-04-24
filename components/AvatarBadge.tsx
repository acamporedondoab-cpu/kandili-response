import { View, Text, StyleSheet } from "react-native";

export default function AvatarBadge() {
  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        <Text style={styles.icon}>👤</Text>
        <View style={styles.plusBadge}>
          <Text style={styles.plus}>+</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(59,130,246,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(59,130,246,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 26,
  },
  plusBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#060d1b",
  },
  plus: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 14,
  },
});
