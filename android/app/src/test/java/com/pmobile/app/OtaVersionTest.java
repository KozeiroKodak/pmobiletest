package com.pmobile.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class OtaVersionTest {
    @Test public void comparesNumericSegmentsAndNativeVersions() {
        assertTrue(OtaVersion.parse("0.0.400").compareTo(OtaVersion.parse("0.0.399")) > 0);
        assertEquals(0, OtaVersion.parse("1.0").compareTo(OtaVersion.parse("1.0.0")));
        assertTrue(OtaVersion.parse("1.03").compareTo(OtaVersion.parse("1.02")) > 0);
    }
    @Test public void rejectsUnsafeAndInvalidVersions() {
        for (String invalid : new String[]{"../1", "1/x", "", "1.-2", "a.1"}) {
            try { OtaVersion.parse(invalid); fail(invalid); }
            catch (IllegalArgumentException expected) { }
        }
    }
}
