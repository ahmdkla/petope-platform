# Renames EXSAVERSE reference screenshots to numbered, path-safe filenames.
#
# HOW TO RUN
#   1. Copy this file into the folder containing the screenshots.
#   2. Right-click it -> "Run with PowerShell"
#      (or open PowerShell in the folder and run:  .\RENAME.ps1 )
#
# Run it with -WhatIf first to preview without changing anything:
#   .\RENAME.ps1 -WhatIf
#
# Safe to re-run: files already renamed are skipped.

[CmdletBinding(SupportsShouldProcess)]
param()

$map = [ordered]@{
    'how the discord look.jpg'                                                                                                          = '01-server-overview.jpg'
    'user on top left.jpg'                                                                                                              = '02-user-panel.jpg'
    'of course a notification to let middleman or buyers or seller know that someone tag them.jpg'                                      = '03-mention-notification.jpg'
    'Information Category.jpg'                                                                                                          = '04-information-category.jpg'
    'Information about middleman, so buyer or seller can know about the teams.jpg'                                                       = '05-mm-roster-exsa-crew.jpg'
    'General Marketplace.jpg'                                                                                                           = '06-marketplace-category.jpg'
    'a General chat for Buyer or seller to communicate.jpg'                                                                             = '07-general-chat.jpg'
    'Selling listing for buyer too look at available Whitelists listed by the sellers.jpg'                                              = '08-selling-listing.jpg'
    'Buying listing for Seller too look at any Whitelists demanded listed by the buyer.jpg'                                             = '09-buying-listing.jpg'
    'this is what seller need to input when they want to post in selling listing.jpg'                                                   = '10-sell-command-fields.jpg'
    'this is what buyer need to input when they want to post in buying listing.jpg'                                                     = '11-buy-command-fields.jpg'
    'Last sales projects or Whitelists.jpg'                                                                                             = '12-last-sales.jpg'
    'Vouches for seller and Buyer to leave a good review to middlemans so others will trust them more.jpg'                              = '13-mm-vouches.jpg'
    'Support Category.jpg'                                                                                                              = '14-support-category.jpg'
    'The Tickets or Channels to P2P.jpg'                                                                                                = '15-ticket-categories.jpg'
    'Tickets already have P2P Process.jpg'                                                                                              = '16-pending-payment.jpg'
    'Tickets for all the middleman.jpg'                                                                                                 = '17-mm-queues.jpg'
    'Team Category.jpg'                                                                                                                 = '18-team-category.jpg'
    'a Team chat for middleman to communicate.jpg'                                                                                      = '19-team-chat.jpg'
    'A channels that use to report if a problem happened in a ticket that need for other middlemans or the boss middleman to review and make decision.jpg' = '20-ticket-problem-escalation.jpg'
    'Faqs 1.jpg'                                                                                                                        = '21-faq-mm-collateral-cancel.jpg'
    'Faqs 2.jpg'                                                                                                                        = '22-faq-discord-wallet-surrender.jpg'
    'Faqs 3.jpg'                                                                                                                        = '23-faq-wallet-submit-mint-for-you.jpg'
    'Faqs 4.jpg'                                                                                                                        = '24-faq-mint-presale-code.jpg'
    'Faqs 5.jpg'                                                                                                                        = '25-faq-otc-after-mint-payments.jpg'
}

$renamed = 0
$skipped  = 0
$missing  = 0

foreach ($old in $map.Keys) {
    $new = $map[$old]

    if (Test-Path -LiteralPath $new) {
        Write-Host "SKIP    $new (already exists)" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    if (-not (Test-Path -LiteralPath $old)) {
        Write-Host "MISSING $old" -ForegroundColor Yellow
        $missing++
        continue
    }

    if ($PSCmdlet.ShouldProcess($old, "Rename to $new")) {
        Rename-Item -LiteralPath $old -NewName $new
        Write-Host "OK      $new" -ForegroundColor Green
        $renamed++
    }
}

Write-Host ""
Write-Host "Renamed: $renamed  |  Skipped: $skipped  |  Missing: $missing"
Write-Host "Remember to update README.md if you rename." -ForegroundColor Cyan
