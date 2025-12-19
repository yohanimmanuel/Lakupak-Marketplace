import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';

export default function CommunityRulesModal() {
  const [activeTab, setActiveTab] = useState<'overview' | 'dos' | 'donts' | 'summary'>('overview');

  const TabButton = ({ id, title }: { id: typeof activeTab; title: string }) => (
    <Pressable
      onPress={() => setActiveTab(id)}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 2,
        borderBottomColor: activeTab === id ? '#0a61d7' : 'transparent',
      }}
    >
      <Text style={{
        color: activeTab === id ? '#0a61d7' : '#6B7280',
        fontWeight: activeTab === id ? '600' : '400',
        fontSize: 14,
      }}>
        {title}
      </Text>
    </Pressable>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <ScrollView style={{ padding: 16 }}>
            <Text style={{ fontSize: 16, lineHeight: 24, color: '#111827', marginBottom: 16 }}>
              Welcome to Laku Marketplace! Our community rules ensure a safe, respectful, and productive environment for all users.
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 24, color: '#111827', marginBottom: 16 }}>
              These guidelines apply to all interactions on our platform, including product listings, reviews, messages, and community discussions.
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 24, color: '#111827', marginBottom: 16 }}>
              By using Laku, you agree to follow these community standards and help us maintain a positive marketplace experience for everyone.
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 24, color: '#111827' }}>
              Violations of these rules may result in warnings, content removal, account restrictions, or permanent suspension.
            </Text>
          </ScrollView>
        );
      
      case 'dos':
        return (
          <ScrollView style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 }}>
              ✅ What You Should Do
            </Text>
            
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                Be Respectful & Professional
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                • Treat all users with respect and courtesy{'\n'}
                • Use polite language in all communications{'\n'}
                • Provide helpful and constructive feedback{'\n'}
                • Be patient and understanding with other users
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                Provide Accurate Information
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                • List products with honest descriptions{'\n'}
                • Use clear, high-quality product photos{'\n'}
                • Provide accurate pricing and availability{'\n'}
                • Update product information regularly
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                Maintain Quality Standards
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                • Ensure products meet safety standards{'\n'}
                • Package items securely for shipping{'\n'}
                • Provide excellent customer service{'\n'}
                • Honor return and refund policies
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                Report Issues Responsibly
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563' }}>
                • Report suspicious or inappropriate behavior{'\n'}
                • Flag counterfeit or illegal products{'\n'}
                • Contact support for technical issues{'\n'}
                • Help maintain platform integrity
              </Text>
            </View>
          </ScrollView>
        );
      
      case 'donts':
        return (
          <ScrollView style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 }}>
              ❌ What You Shouldn't Do
            </Text>
            
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                Prohibited Content & Behavior
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                • No harassment, bullying, or hate speech{'\n'}
                • No spam, scams, or fraudulent activities{'\n'}
                • No counterfeit or illegal products{'\n'}
                • No inappropriate or offensive content
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                Misleading Practices
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                • Don't use fake reviews or ratings{'\n'}
                • Don't manipulate search results{'\n'}
                • Don't create duplicate accounts{'\n'}
                • Don't misrepresent product quality
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                Privacy & Security Violations
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                • Don't share personal information publicly{'\n'}
                • Don't attempt to hack or exploit the platform{'\n'}
                • Don't use unauthorized payment methods{'\n'}
                • Don't violate intellectual property rights
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                Platform Abuse
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563' }}>
                • Don't circumvent platform policies{'\n'}
                • Don't use automated tools without permission{'\n'}
                • Don't engage in price manipulation{'\n'}
                • Don't interfere with other users' transactions
              </Text>
            </View>
          </ScrollView>
        );
      
      case 'summary':
        return (
          <ScrollView style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 }}>
              📋 Summary
            </Text>
            
            <View style={{ backgroundColor: '#F0F9FF', padding: 16, borderRadius: 12, marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#0C4A6E', marginBottom: 8 }}>
                Core Principles
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#075985' }}>
                Laku Marketplace is built on trust, respect, and mutual benefit. We expect all users to contribute positively to our community.
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 }}>
                Key Takeaways:
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 8 }}>
                • Be honest, respectful, and professional in all interactions
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 8 }}>
                • Provide accurate product information and quality service
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 8 }}>
                • Report violations and help maintain platform integrity
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 8 }}>
                • Respect others' privacy and intellectual property
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563' }}>
                • Follow all applicable laws and regulations
              </Text>
            </View>

            <View style={{ backgroundColor: '#FEF3C7', padding: 16, borderRadius: 12, marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#92400E', marginBottom: 8 }}>
                Enforcement
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#B45309' }}>
                Violations are reviewed on a case-by-case basis. We may issue warnings, remove content, restrict accounts, or suspend users who repeatedly violate these rules.
              </Text>
            </View>

            <View style={{ backgroundColor: '#ECFDF5', padding: 16, borderRadius: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#065F46', marginBottom: 8 }}>
                Questions?
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#047857' }}>
                If you have questions about these rules or need to report a violation, please contact our support team through the Help Center.
              </Text>
            </View>
          </ScrollView>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {/* Sticky Tabs */}
      <View style={{ 
        flexDirection: 'row', 
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb'
      }}>
        <TabButton id="overview" title="Overview" />
        <TabButton id="dos" title="Dos" />
        <TabButton id="donts" title="Don'ts" />
        <TabButton id="summary" title="Summary" />
      </View>

      {/* Content */}
      {renderContent()}
    </View>
  );
}
