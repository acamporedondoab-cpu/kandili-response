import { View, Image, Text, StyleSheet } from "react-native";

export default function LogoHeader() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.tagline}>
        {"One Tap. "}
        <Text style={styles.blue}>{"We Track. "}</Text>
        <Text style={styles.red}>{"We Respond—Fast."}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  logo: {
    width: 160,
    height: 160,
  },
  tagline: {
    marginTop: 10,
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  blue: {
    color: "#3b82f6",
  },
  red: {
    color: "#DC2626",
  },
});
