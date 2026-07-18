import { describe, expect, it } from "vitest";
import { hiraJsonItems, matchHiraFacility, parseHiraCapabilities, parseHiraHospitalXml } from "./hiraHospital";

describe("HIRA hospital data", () => {
  it("parses the official hospital-list XML without exposing the service key", () => {
    const facilities = parseHiraHospitalXml(`<?xml version="1.0"?><response><header><resultCode>00</resultCode></header><body><items><item>
      <addr>서울특별시 동대문구 왕산로 123</addr><clCdNm>의원</clCdNm><drTotCnt>3</drTotCnt>
      <telno>02-123-4567</telno><XPos>127.0341</XPos><YPos>37.5788</YPos>
      <yadmNm><![CDATA[나루내과의원]]></yadmNm><ykiho>encrypted-id</ykiho>
    </item></items></body></response>`);
    expect(facilities).toEqual([expect.objectContaining({
      ykiho: "encrypted-id", name: "나루내과의원", institutionType: "의원", totalDoctors: 3,
      phone: "02-123-4567", lat: 37.5788, lng: 127.0341,
    })]);
  });

  it("normalizes singleton and array JSON item shapes", () => {
    expect(hiraJsonItems({ response: { body: { items: { item: { dgsbjtCdNm: "내과" } } } } })).toHaveLength(1);
    expect(hiraJsonItems({ response: { body: { items: { item: [{ dgsbjtCdNm: "내과" }, { dgsbjtCdNm: "소아청소년과" }] } } } })).toHaveLength(2);
  });

  it("combines official specialties, specialists, equipment and special-care fields", () => {
    const capabilities = parseHiraCapabilities({
      specialties: { response: { body: { items: { item: [{ dgsbjtCdNm: "내과" }, { dgsbjtCdNm: "가정의학과" }] } } } },
      specialists: { response: { body: { items: { item: { dgsbjtCdNm: "내과", dgsbjtPrSdrCnt: 2 } } } } },
      equipment: { response: { body: { items: { item: { oefCdNm: "초음파영상진단기" } } } } },
      specialCare: { response: { body: { items: { item: { srchCdNm: "혈액투석" } } } } },
    });
    expect(capabilities).toEqual({
      specialties: ["내과", "가정의학과"],
      specialists: [{ specialty: "내과", count: 2 }],
      equipment: ["초음파영상진단기"],
      specialCare: ["혈액투석"],
    });
  });

  it("matches providers by normalized phone/name and rejects nearby unrelated clinics", () => {
    const facilities = [
      { ykiho: "one", name: "나루 내과의원", phone: "02-1234-5678", lat: 37.5788, lng: 127.0341 },
      { ykiho: "two", name: "다른 정형외과", phone: "02-9999-9999", lat: 37.57881, lng: 127.03411 },
    ];
    expect(matchHiraFacility({ name: "나루내과의원", phone: "02 1234 5678", lat: 37.5788, lng: 127.0341 }, facilities)?.ykiho).toBe("one");
    expect(matchHiraFacility({ name: "무관한소아과", lat: 37.5788, lng: 127.0341 }, facilities)).toBeUndefined();
  });
});
