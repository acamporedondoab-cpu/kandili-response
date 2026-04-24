import { View, Text, TextInput, StyleSheet } from "react-native";

export default function InputField({
  label,
  placeholder,
  helper,
  value,
  onChangeText,
  keyboardType = "default",
  prefix,
  icon,
  secureTextEntry = false,
}: any) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {icon && (
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>{icon}</Text>
          </View>
        )}
        <View style={styles.content}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.inputRow}>
            {prefix && (
              <>
                <View style={styles.prefixBox}>
                  <Text style={styles.prefixText}>{prefix}</Text>
                  <Text style={styles.caret}>▾</Text>
                </View>
                <View style={styles.divider} />
              </>
            )}
            <TextInput
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor="#4b6a8a"
              keyboardType={keyboardType}
              autoCapitalize="none"
              secureTextEntry={secureTextEntry}
              style={[styles.input, prefix ? { flex: 1 } : styles.inputFull]}
            />
          </View>
          {helper && <Text style={styles.helper}>{helper}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  iconText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  label: {
    color: "#4b6a8a",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.0,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  prefixBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  prefixText: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "700",
  },
  caret: {
    color: "#4b6a8a",
    fontSize: 11,
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  input: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
    paddingVertical: 0,
    minHeight: 24,
  },
  inputFull: {
    width: "100%",
  },
  helper: {
    marginTop: 6,
    color: "#374d6a",
    fontSize: 11,
    lineHeight: 15,
  },
});
