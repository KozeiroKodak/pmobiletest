package com.pmobile.app;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;

/** Numeric, dot-separated web/native version comparison used by OTA metadata. */
public final class OtaVersion implements Comparable<OtaVersion> {

    private final String value;
    private final List<BigInteger> components;

    private OtaVersion(String value, List<BigInteger> components) {
        this.value = value;
        this.components = components;
    }

    /**
     * Parses versions in the form {@code 1}, {@code 1.2}, or {@code 1.2.3}.
     * Components must be non-negative decimal integers; suffixes are rejected.
     */
    public static OtaVersion parse(String value) {
        if (value == null || value.isEmpty() || !value.equals(value.trim())) {
            throw new IllegalArgumentException("Version must be a non-empty dotted number");
        }

        String[] parts = value.split("\\.", -1);
        List<BigInteger> components = new ArrayList<>(parts.length);
        for (String part : parts) {
            if (part.isEmpty()) {
                throw new IllegalArgumentException("Invalid version: " + value);
            }
            for (int i = 0; i < part.length(); i++) {
                if (part.charAt(i) < '0' || part.charAt(i) > '9') {
                    throw new IllegalArgumentException("Invalid version: " + value);
                }
            }
            components.add(new BigInteger(part));
        }
        return new OtaVersion(value, components);
    }

    @Override
    public int compareTo(OtaVersion other) {
        int count = Math.max(components.size(), other.components.size());
        for (int i = 0; i < count; i++) {
            BigInteger left = i < components.size() ? components.get(i) : BigInteger.ZERO;
            BigInteger right = i < other.components.size() ? other.components.get(i) : BigInteger.ZERO;
            int result = left.compareTo(right);
            if (result != 0) {
                return result;
            }
        }
        return 0;
    }

    @Override
    public String toString() {
        return value;
    }
}
